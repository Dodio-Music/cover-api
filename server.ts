import Fastify from "fastify";
import multipart from "@fastify/multipart";
import path from "node:path";
import * as fs from "node:fs";
import {configDotenv} from "dotenv";

configDotenv();

const UPLOAD_DIR = process.env.UPLOAD_DIR;
const TOKEN = process.env.COVER_API_KEY;

if (!TOKEN || !UPLOAD_DIR) {
    console.error("Please configure .env! Take a look at .env.example");
    process.exit(1);
}

fs.mkdirSync(UPLOAD_DIR!, {recursive: true});

const fastify = Fastify({logger: true});
fastify.register(multipart, {
    limits: {
        fileSize: 10_000_000,
        files: 1
    }
});

fastify.post("/dodio/cover/upload", async (req, reply) => {
    const token = req.headers["x-upload-token"];
    if (token !== TOKEN) {
        return reply.status(401).send({success: false, error: "Invalid token"});
    }

    if (!req.isMultipart()) {
        return reply.status(400).send({success: false, error: "Request must be multipart/form-data with a file"});
    }

    const data = await req.file();

    if (!data || !data.filename) return reply.status(400).send({success: false, error: "No file uploaded"});

    if (data.file.truncated) {
        reply.status(400).send({success: false, error: "File too big! Cover should be smaller than 10MB."});
    }

    const allowedTypes = ["image/png", "image/jpeg", "image/jpg"];
    if (!allowedTypes.includes(data.mimetype)) {
        return reply.status(400).send({success: false, error: "Invalid file type"});
    }

    const filePath = path.join(UPLOAD_DIR!, data.filename);
    await new Promise<void>((resolve, reject) => {
        const writeStream = fs.createWriteStream(filePath);
        data.file.pipe(writeStream);
        writeStream.on("finish", () => resolve());
        writeStream.on("error", reject);
    });

    reply.send({success: true, path: `/dodio/covers/${data.filename}`});
});

fastify.listen({port: 8081, host: "0.0.0.0"}, (err, address) => {
    if (err) throw err;
    console.log(`Cover API running at ${address}`);
});
