import os
import pg8000
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google.cloud.alloydb.connector import Connector, IPTypes
import sqlalchemy
from pydantic import BaseModel

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

PROJECT_ID = os.environ.get("PROJECT_ID", "YOUR_GCP_PROJECT_ID") # Change this
REGION = "us-central1"
CLUSTER = "hospital-ops-cluster"
INSTANCE = "hospital-ops-instance"
DB_USER = "postgres"
DB_PASS = "hospital-ops-pass"

connector = Connector()

def getconn() -> pg8000.dbapi.Connection:
    return connector.connect(
        f"projects/{PROJECT_ID}/locations/{REGION}/clusters/{CLUSTER}/instances/{INSTANCE}",
        "pg8000", user=DB_USER, password=DB_PASS, db="postgres",
        enable_iam_auth=False, ip_type=IPTypes.PUBLIC
    )

pool = sqlalchemy.create_engine("postgresql+pg8000://", creator=getconn)

class SearchQuery(BaseModel):
    description: str

@app.post("/search")
def search_inventory(query: SearchQuery):
    try:
        with pool.connect() as db_conn:
            sql = sqlalchemy.text("""
                SELECT item_name, supplier_name, stock_level FROM medical_inventory 
                ORDER BY item_embedding <=> ai.embedding('text-embedding-005', :text)::vector LIMIT 1;
            """)
            result = db_conn.execute(sql, {"text": query.description}).fetchone()
            if result:
                return {"item": result[0], "supplier": result[1], "current_stock": result[2]}
            return {"message": "No supplies found."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))