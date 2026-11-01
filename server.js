
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Statische Dateien bereitstellen
app.use(express.static(__dirname));

// Hauptseite
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

// Server starten
app.listen(PORT, "0.0.0.0", () => {
    console.log(`ONE MILLION COINS läuft auf Port ${PORT}`);
});
