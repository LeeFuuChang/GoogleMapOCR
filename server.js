const Detect = require("./detect");

const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = 5500;

app.use(cors());

app.use(express.static("public"));

const storage = multer.memoryStorage();
const upload = multer({ storage });

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.post("/upload", upload.single("image"), (req, res) => {
    Detect({
        name: req.file.originalname,
        buffer: req.file.buffer,
    }).then((result) => {
        res.status(200).send({
            detection: result,
        });
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on PORT(${PORT})`);
});
