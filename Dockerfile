# 1. Start with a lightweight Python system
FROM python:3.9-slim

# 2. Create a folder inside the container
WORKDIR /app

# 3. Copy the requirements file from your laptop into the container
COPY requirements.txt .

# 4. Install the libraries inside the container
RUN pip install -r requirements.txt

# 5. Copy the rest of your code (app.py) into the container
COPY . .

# 6. Run the app
CMD ["python", "app.py"]