# Dodio Cover API

Fastify API to handle cover art uploads for Dodio.  
Uploaded images are served via Caddy.

---

## Setup

1. **Clone repository**
```bash
git clone https://github.com/Dodio-Music/cover-api.git
cd cover-api
```

2. **Install dependencies**
```bash
npm install
```

3. **Create `.env` file**
```ini
COVER_API_KEY=supersecret123
UPLOAD_DIR=/var/www/example/covers
```

4. **Ensure upload directory exists & has correct permissions**
``` bash
sudo mkdir -p /var/www/example/covers
sudo chown -R $USER:www-data /var/www/example/covers
sudo chmod -R 775 /var/www/example/covers
```

5. **Run in development**
```bash
npm run dev
```

6. **Build for production**
```bash
npm run build
npm run start
```