/*
//connect to mongodb
mongoose.connect('mongodb://localhost:27017/chat', { useNewUrlParser: true });
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function () {
    console.log('MongoDB Connected');
});

const chatSchema = mongoose.Schema({
    nickname: String,
    message: String,
    created: { type: Date, default: Date.now }
});

const Chat = mongoose.model('Message', chatSchema);

*/


    //load old message
    // Chat.remove({});
    // const query = Chat.find({});
    // query.sort('-created').limit(8).exec((err, data) => {
    //     if (err) console.log(err);
    //     socket.emit('old messages', data);
    // });
    // 
//save to database
        // var newMsg = new Chat({ nickname: socket.nickname, message: data.msg });
        // newMsg.save((err) => {
        //     if (err) console.log(err);
        //     io.sockets.emit('new message', { name: socket.nickname, msg: data.msg });
        // });