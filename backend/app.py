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
    # required fields
    for k in ("company", "location", "url"):
        if k not in data or not str(data[k]).strip():
            return jsonify({"error": f"Missing or empty '{k}'"}), 400
    item = {
        "id": str(uuid.uuid4()),
        "company": data["company"].strip(),
        "location": data["location"].strip(),
        "url": data["url"].strip(),
        "updated_at": now_iso(),
    }
    table.put_item(Item=item)
    return jsonify(item), 201

@app.delete("/api/companies/<id>")
def delete_company(id):
    # best-effort delete (id is the PK)
    table.delete_item(Key={"id": id})
    return jsonify({"deleted": id}), 200

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8000)
