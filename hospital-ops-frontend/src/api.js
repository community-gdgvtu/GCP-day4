import axios from 'axios';

const VISION_URL = 'https://vision-agent-720231581460.us-central1.run.app';

export const analyzeWard = async (base64Image) => {
  try {
    const response = await axios.post(`${VISION_URL}/analyze-ward`, { 
      image_data: base64Image 
    }, {
      timeout: 15000 // 15 seconds to ensure large webcam frames process
    });
    
    return response.data;
  } catch (error) {
    // FASTAPI ERROR EXTRACTOR: This cracks open the 422 error
    // so you can see exactly what Python is complaining about.
    let exactError = error.message;
    if (error.response?.data?.detail) {
      exactError = JSON.stringify(error.response.data.detail);
    }
    
    console.error("FastAPI Rejection Details:", exactError);
    return { error: exactError };
  }
};