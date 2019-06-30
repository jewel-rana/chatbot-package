module.exports = function (app, express) {
    var api = express.Router();
    // utility function for sorting an array by a key in alpha order
    api.get("/", (req, res) => {
        res.render("index");
    });

    api.post("/login", (req, res) => {
        console.log(req.body.email);
        res.writeHead(302, { Location: "http://localhost:4000/chat" });
        res.end();
    });

    api.get("/chat", (req, res) => {
        res.render("chat");
    });
    return api;
}