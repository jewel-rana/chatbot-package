const express = require('express');
const router = express.Router();


router.get("/", (req, res) => {
    res.render(__dirname + "/index");
});

router.post("/login", (req, res) => {
    console.log(req.body.email);
    res.writeHead(302, { Location: "http://localhost:4000/chat" });
    res.end();
});

router.get("/chat", (req, res) => {
    res.render(__dirname + "/chat");
});

module.express = router;