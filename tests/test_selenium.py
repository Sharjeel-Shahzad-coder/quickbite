"""Selenium end-to-end tests for QuickBite.

Run against the AWS Load Balancer:
    BASE_URL=http://<alb-dns-name> pytest tests -v --html=reports/report.html --self-contained-html
"""
import os

import pytest
from selenium import webdriver
from selenium.common.exceptions import ElementClickInterceptedException
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import Select, WebDriverWait

BASE_URL = os.getenv("BASE_URL", "http://localhost").rstrip("/")
ADMIN_KEY = os.getenv("ADMIN_KEY", "admin-secret-123")
state = {}


@pytest.fixture(scope="module")
def driver():
    opts = webdriver.ChromeOptions()
    opts.add_argument("--headless=new")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--window-size=1280,900")
    drv = webdriver.Chrome(options=opts)  # Selenium Manager downloads the driver
    drv.implicitly_wait(0)
    yield drv
    drv.quit()


def wait(drv, secs=10):
    return WebDriverWait(drv, secs)


def safe_click(drv, element):
    """Scroll the element to the centre of the window, then click it.

    A sticky header or another element can sometimes sit on top of a button
    and make Selenium raise ElementClickInterceptedException. Scrolling to the
    centre avoids that; if it still happens, fall back to a JavaScript click.
    """
    drv.execute_script(
        "arguments[0].scrollIntoView({block: 'center', behavior: 'instant'});", element)
    try:
        element.click()
    except Exception:
        drv.execute_script("arguments[0].click();", element)


def test_01_home_page_lists_restaurants(driver):
    driver.get(BASE_URL + "/index.html")
    assert "QuickBite" in driver.title
    wait(driver).until(EC.presence_of_element_located((By.CSS_SELECTOR, "#restaurant-list .restaurant-card")))
    cards = driver.find_elements(By.CSS_SELECTOR, ".restaurant-card")
    assert len(cards) >= 4


def test_02_add_item_updates_cart_badge(driver):
    driver.get(BASE_URL + "/index.html")
    card = wait(driver).until(EC.element_to_be_clickable((By.CSS_SELECTOR, ".restaurant-card")))
    safe_click(driver, card)
    wait(driver).until(EC.presence_of_element_located((By.CSS_SELECTOR, "#menu-list .add-btn")))
    safe_click(driver, driver.find_element(By.CSS_SELECTOR, ".add-btn"))
    wait(driver).until(EC.text_to_be_present_in_element((By.ID, "cart-count"), "1"))


def test_03_checkout_places_order(driver):
    driver.get(BASE_URL + "/cart.html")
    wait(driver).until(EC.presence_of_element_located((By.CSS_SELECTOR, "#cart-items .menu-row")))
    driver.find_element(By.ID, "customer_name").send_keys("Selenium Tester")
    driver.find_element(By.ID, "phone").send_keys("0300-1234567")
    driver.find_element(By.ID, "address").send_keys("House 1, Test Street, Lahore")
    safe_click(driver, driver.find_element(By.ID, "place-order"))
    box = wait(driver).until(EC.visibility_of_element_located((By.ID, "order-confirmation")))
    order_id = driver.find_element(By.ID, "order-id").text
    assert box.is_displayed() and order_id.isdigit()
    state["order_id"] = order_id


def test_04_tracking_shows_placed_status(driver):
    assert "order_id" in state, "checkout test must run first"
    driver.get(f"{BASE_URL}/track.html?id={state['order_id']}")
    status = wait(driver).until(EC.visibility_of_element_located((By.ID, "order-status")))
    assert status.text == "Placed"


def test_05_admin_can_advance_order(driver):
    assert "order_id" in state, "checkout test must run first"
    driver.get(BASE_URL + "/admin.html")
    driver.find_element(By.ID, "admin-key").send_keys(ADMIN_KEY)
    safe_click(driver, driver.find_element(By.ID, "login-btn"))
    wait(driver).until(EC.visibility_of_element_located((By.ID, "orders-table")))
    select = wait(driver).until(EC.presence_of_element_located(
        (By.CSS_SELECTOR, f"select[data-id='{state['order_id']}']")))
    Select(select).select_by_visible_text("Preparing")
    wait(driver).until(EC.presence_of_element_located((By.CSS_SELECTOR, ".toast")))
    driver.get(f"{BASE_URL}/track.html?id={state['order_id']}")
    wait(driver).until(EC.text_to_be_present_in_element((By.ID, "order-status"), "Preparing"))


def test_06_health_endpoint(driver):
    driver.get(BASE_URL + "/health")
    assert '"status":"ok"' in driver.page_source.replace(" ", "")