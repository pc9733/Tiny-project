from flask import Flask, request, jsonify
from flask_cors import CORS
import boto3, os, uuid, datetime
from boto3.dynamodb.conditions import Key

TABLE_NAME = os.getenv("TABLE_NAME", "companies")
REGION = os.getenv("AWS_REGION", "us-east-1")

dynamodb = boto3.resource("dynamodb", region_name=REGION)
table = dynamodb.Table(TABLE_NAME)

app = Flask(__name__)
CORS(app)

def now_iso():
    return datetime.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"

def normalize_payload(data, partial=False):
    if not isinstance(data, dict):
        raise ValueError("Invalid JSON body.")

    cleaned = {}

    def _trim(value):
        if value is None:
            return ""
        return str(value).strip()

    for field in ("company", "location", "url"):
        if field not in data:
            continue
        value = _trim(data[field])
        if field in ("company", "location") and not value:
            raise ValueError(f"Missing or empty '{field}'")
        cleaned[field] = value

    if not partial:
        for field in ("company", "location"):
            if field not in cleaned:
                raise ValueError(f"Missing or empty '{field}'")

    if partial and not cleaned:
        raise ValueError("No fields provided for update.")

    return cleaned

@app.get("/health")
def health():
    return {"ok": True}, 200

@app.get("/api/companies")
def list_companies():
    loc = request.args.get("location")
    if loc:
        resp = table.query(
            IndexName="LocationIndex",
            KeyConditionExpression=Key("location").eq(loc)
        )
        items = resp.get("Items", [])
    else:
        # small scan for demo
        resp = table.scan(Limit=200)
        items = resp.get("Items", [])
    # normalize fields
    out = []
    for it in items:
        out.append({
            "id": it.get("id"),
            "company": it.get("company"),
            "location": it.get("location"),
            "url": it.get("url"),
            "updated_at": it.get("updated_at")
        })
    return jsonify(out), 200

@app.post("/api/companies")
def add_company():
    data = request.get_json(force=True, silent=True) or {}
    try:
        payload = normalize_payload(data)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    item = {
        "id": str(uuid.uuid4()),
        "updated_at": now_iso(),
        **payload,
    }
    table.put_item(Item=item)
    return jsonify(item), 201


@app.put("/api/companies/<id>")
def update_company(id):
    data = request.get_json(force=True, silent=True) or {}
    try:
        payload = normalize_payload(data, partial=True)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    resp = table.get_item(Key={"id": id})
    item = resp.get("Item")
    if not item:
        return jsonify({"error": "Not found"}), 404

    item.update(payload)
    item["updated_at"] = now_iso()
    table.put_item(Item=item)
    return jsonify(item), 200

@app.delete("/api/companies/<id>")
def delete_company(id):
    # best-effort delete (id is the PK)
    table.delete_item(Key={"id": id})
    return jsonify({"deleted": id}), 200

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8000)
