import os
import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import google.generativeai as genai
from pydantic import BaseModel

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

genai.configure(api_key=os.environ.get("GEMINI_API_KEY", "YOUR_API_KEY")) # Change this
model = genai.GenerativeModel('gemini-2.5-flash')

# This will be injected by Docker Compose or Cloud Run
INVENTORY_AGENT_URL = os.environ.get("INVENTORY_AGENT_URL", "http://inventory-agent:8080")

class VisionPayload(BaseModel):
    image_data: str # Now accepts raw base64 data from the webcam

@app.post("/analyze-ward")
async def analyze_ward(payload: VisionPayload):
    # Package the raw image data for Gemini
    image_part = {
        "mime_type": "image/jpeg",
        "data": payload.image_data
    }
    
    prompt = [
        "Analyze this medical supply image. Count the IV bags. Briefly explain your count. If the count is below 5, end your response with EXACTLY 'STATUS: RESTOCK'. If it is 5 or more, end with EXACTLY 'STATUS: NORMAL'.",
        image_part
    ]
    
    try:
        response = model.generate_content(prompt)
        text = response.text
        
        if "STATUS: RESTOCK" in text.upper():
            async with httpx.AsyncClient() as client:
                inv_res = await client.post(
                    f"{INVENTORY_AGENT_URL}/search", 
                    json={"description": "Saline IV Bags"}
                )
                return {
                    "analysis": text, 
                    "action": "Restock Triggered", 
                    "inventory": inv_res.json()
                }
                
        return {"analysis": text, "status": "Normal"}
        
    except Exception as e:
        return {"error": str(e)}