"""QuickBite API - Flask + PostgreSQL."""
import logging
import os
import socket

import psycopg2
import psycopg2.extras
from flask import Flask, jsonify, request

app = Flask(__name__)
STATUSES = ["Placed", "Preparing", "Out for delivery", "Delivered"]
ADMIN_KEY = os.getenv("ADMIN_KEY", "")

os.makedirs("/app/logs", exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    handlers=[logging.StreamHandler(), logging.FileHandler("/app/logs/orders.log")],
)
log = logging.getLogger("quickbite")


def connect():
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "db"),
        dbname=os.getenv("DB_NAME", "quickbite"),
        user=os.getenv("DB_USER", "quickbite"),
        password=os.getenv("DB_PASSWORD", ""),
        connect_timeout=5,
    )


def query(sql, args=(), one=False):
    conn = connect()
    try:
        with conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, args)
            rows = cur.fetchall() if cur.description else None
            if one:
                return rows[0] if rows else None
            return rows
    finally:
        conn.close()


def error(msg, code=400):
    return jsonify({"error": msg}), code


def require_admin():
    if not ADMIN_KEY or request.headers.get("X-Admin-Key") != ADMIN_KEY:
        return error("Invalid admin key", 401)
    return None


@app.get("/health")
def health():
    try:
        query("SELECT 1")
        db_ok = True
    except Exception:
        db_ok = False
    body = {"status": "ok" if db_ok else "degraded", "db": db_ok, "host": socket.gethostname()}
    return jsonify(body), (200 if db_ok else 503)


@app.get("/api/restaurants")
def restaurants():
    return jsonify(query(
        "SELECT id, name, cuisine, rating::float AS rating, delivery_time, description "
        "FROM restaurants ORDER BY rating DESC"))


@app.get("/api/restaurants/<int:rid>/menu")
def menu(rid):
    rest = query("SELECT id, name, cuisine, rating::float AS rating, delivery_time, description "
                 "FROM restaurants WHERE id=%s", (rid,), one=True)
    if not rest:
        return error("Restaurant not found", 404)
    items = query("SELECT id, name, description, price::float AS price, category "
                  "FROM menu_items WHERE restaurant_id=%s ORDER BY category, name", (rid,))
    return jsonify({"restaurant": rest, "items": items})


@app.post("/api/orders")
def create_order():
    data = request.get_json(silent=True) or {}
    name = str(data.get("customer_name", "")).strip()
    phone = str(data.get("phone", "")).strip()
    address = str(data.get("address", "")).strip()
    try:
        qty = {int(i["id"]): max(1, min(int(i.get("qty", 1)), 20)) for i in data.get("items", [])}
    except (KeyError, ValueError, TypeError):
        return error("Invalid items")
    if not (name and phone and address and qty):
        return error("Name, phone, address and at least one item are required")

    conn = connect()
    try:
        with conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT id, name, price::float AS price FROM menu_items WHERE id = ANY(%s)",
                        (list(qty),))
            rows = cur.fetchall()
            if not rows:
                return error("No valid items in order")
            total = round(sum(r["price"] * qty[r["id"]] for r in rows), 2)
            cur.execute("INSERT INTO orders (customer_name, phone, address, total) "
                        "VALUES (%s,%s,%s,%s) RETURNING id", (name, phone, address, total))
            oid = cur.fetchone()["id"]
            for r in rows:
                cur.execute("INSERT INTO order_items (order_id, item_name, price, qty) "
                            "VALUES (%s,%s,%s,%s)", (oid, r["name"], r["price"], qty[r["id"]]))
    finally:
        conn.close()
    log.info("order created id=%s total=%s host=%s", oid, total, socket.gethostname())
    return jsonify({"order_id": oid, "total": total, "status": "Placed"}), 201


@app.get("/api/orders/<int:oid>")
def get_order(oid):
    order = query("SELECT id, customer_name, address, total::float AS total, status, "
                  "to_char(created_at,'YYYY-MM-DD HH24:MI') AS created_at FROM orders WHERE id=%s",
                  (oid,), one=True)
    if not order:
        return error("Order not found", 404)
    order["items"] = query("SELECT item_name, price::float AS price, qty FROM order_items "
                           "WHERE order_id=%s", (oid,))
    order["steps"] = STATUSES
    return jsonify(order)


@app.get("/api/admin/orders")
def admin_orders():
    denied = require_admin()
    if denied:
        return denied
    return jsonify(query(
        "SELECT o.id, o.customer_name, o.phone, o.address, o.total::float AS total, o.status, "
        "to_char(o.created_at,'YYYY-MM-DD HH24:MI') AS created_at, "
        "(SELECT string_agg(item_name || ' x' || qty, ', ') FROM order_items WHERE order_id=o.id) AS items "
        "FROM orders o ORDER BY o.id DESC LIMIT 100"))


@app.patch("/api/admin/orders/<int:oid>/status")
def update_status(oid):
    denied = require_admin()
    if denied:
        return denied
    status = (request.get_json(silent=True) or {}).get("status")
    if status not in STATUSES:
        return error("Invalid status")
    row = query("UPDATE orders SET status=%s WHERE id=%s RETURNING id", (status, oid), one=True)
    if not row:
        return error("Order not found", 404)
    log.info("order %s -> %s", oid, status)
    return jsonify({"order_id": oid, "status": status})


@app.get("/api/admin/stats")
def stats():
    denied = require_admin()
    if denied:
        return denied
    return jsonify(query(
        "SELECT COUNT(*)::int AS orders, COALESCE(SUM(total),0)::float AS revenue, "
        "COUNT(*) FILTER (WHERE status <> 'Delivered')::int AS active FROM orders", one=True))
