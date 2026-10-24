import os

import pytest


@pytest.hookimpl(tryfirst=True, hookwrapper=True)
def pytest_runtest_makereport(item, call):
    """When a test fails, save a screenshot and the page text into reports/."""
    outcome = yield
    report = outcome.get_result()
    if report.when == "call" and report.failed:
        drv = item.funcargs.get("driver")
        if drv:
            os.makedirs("reports", exist_ok=True)
            base = os.path.join("reports", item.name)
            drv.save_screenshot(base + ".png")
            with open(base + ".txt", "w", encoding="utf-8") as f:
                f.write(drv.current_url + "\n\n")
                f.write(drv.find_element("tag name", "body").text)
            print(f"\nSaved failure screenshot: {base}.png")