import Fastify from "fastify";
import multipart from "@fastify/multipart";
import formbody from "@fastify/formbody";
import path from "node:path";
import * as fs from "node:fs";
import {configDotenv} from "dotenv";
import sharp from "sharp";

configDotenv();

const UPLOAD_DIR = process.env.UPLOAD_DIR!;
const TOKEN = process.env.COVER_API_KEY!;

const DIR_ORIGINAL = path.join(UPLOAD_DIR, "original");
const DIR_MID = path.join(UPLOAD_DIR, "mid");
const DIR_LOW = path.join(UPLOAD_DIR, "low");

[DIR_ORIGINAL, DIR_MID, DIR_LOW].forEach((dir) => {
    fs.mkdirSync(dir, {recursive: true});
});

const fastify = Fastify({logger: true});

fastify.register(multipart, {
    limits: {fileSize: 10_000_000, files: 1}
});
fastify.register(formbody);

fastify.post("/", async (req, reply) => {
    const token = req.headers["x-upload-token"];
    if (token !== TOKEN) {
        return reply.status(401).send({success: false, error: "Invalid token"});
    }

    if (!req.isMultipart()) {
        return reply.status(400).send({success: false, error: "Request must be multipart/form-data with a file"});
    }

    const data = await req.file();
    if (!data || !data.filename) {
        return reply.status(400).send({success: false, error: "No file uploaded"});
    }

    if (data.file.truncated) {
        return reply.status(400).send({success: false, error: "File too big! Cover should be smaller than 10MB."});
    }

    const allowedTypes = ["image/png", "image/jpeg", "image/jpg"];
    if (!allowedTypes.includes(data.mimetype)) {
        return reply.status(400).send({success: false, error: "Invalid file type"});
    }

    const originalPath = path.join(DIR_ORIGINAL, data.filename);

    await new Promise<void>((resolve, reject) => {
        const writeStream = fs.createWriteStream(originalPath);
        data.file.pipe(writeStream);
        writeStream.on("finish", () => resolve());
        writeStream.on("error", reject);
    });

    const buffer = await sharp(originalPath).toBuffer();

    const outMid = path.join(DIR_MID, data.filename);
    const outLow = path.join(DIR_LOW, data.filename);

    await sharp(buffer).resize(768, 768).toFile(outMid);
    await sharp(buffer).resize(384, 384).toFile(outLow);

    return reply.send({
        success: true,
        file: `${data.filename}`
    });
});

fastify.delete("/:filename", async (req, reply) => {
    const token = req.headers["x-upload-token"];
    if (token !== TOKEN) {
        return reply.status(401).send({ success: false, error: "Invalid token" });
    }

    const { filename } = req.params as { filename: string };

    const paths = [
        path.join(DIR_ORIGINAL, filename),
        path.join(DIR_LOW, filename),
        path.join(DIR_MID, filename)
    ];

    let deleted = 0;
    let existed = 0;

    for (const p of paths) {
        try {
            await fs.promises.access(p, fs.constants.F_OK);
            existed++;
        } catch {}
    }

    if (existed === 0) {
        return reply.status(404).send({
            success: false,
            error: `Cover '${filename}' does not exist`
        });
    }

    for (const p of paths) {
        try {
            await fs.promises.unlink(p);
            deleted++;
        } catch (err: any) {
            if (err.code !== "ENOENT") {
                return reply.status(500).send({
                    success: false,
                    error: `Failed deleting ${p}`,
                });
            }
        }
    }

    return reply.send({
        success: true,
        deleted,
        message: `${filename} removed from ${deleted} folders`
    });
});

fastify.listen({port: 8081, host: "0.0.0.0"}, (err, address) => {
    if (err) throw err;
    console.log(`Cover API running at ${address}`);
});
