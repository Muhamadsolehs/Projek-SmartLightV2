# Smart Light Trap - Computer Vision Service

Layanan microservice Python FastAPI yang menangani komputasi berat model deteksi serangga nocturnal (YOLOv8-AgriPest).

Layanan ini sengaja dipisahkan dari Supabase Edge Functions untuk menjamin isolasi komputasi, kebebasan penggunaan library AI (PyTorch, Ultralytics, OpenCV, ONNX), dan keandalan response Edge Functions.

## 1. Persiapan Lingkungan

Pastikan Python 3.10+ terpasang di sistem.

```bash
cd services/cv_service
python -m venv venv
# Linux / macOS:
source venv/bin/activate
# Windows:
venv\Scripts\activate

pip install -r requirements.txt
```

## 2. Menjalankan Layanan

```bash
python main.py
```

Layanan akan berjalan di `http://localhost:8000`. Dokumentasi interaktif Swagger UI tersedia di `http://localhost:8000/docs`.

## 3. Variabel Lingkungan

- `CV_SERVICE_SECRET`: Kunci otentikasi service-to-service antara Edge Function dan microservice Python (header `X-Service-Key`).
