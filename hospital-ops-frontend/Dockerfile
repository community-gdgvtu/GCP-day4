# Step 1: Build the React app (Upgraded to Node 20)
FROM node:20-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# You can pass the backend URL during build time
ARG VITE_VISION_AGENT_URL
ENV VITE_VISION_AGENT_URL=$VITE_VISION_AGENT_URL
RUN npm run build

# Step 2: Serve with Nginx
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
# Expose port 8080 for Cloud Run
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]