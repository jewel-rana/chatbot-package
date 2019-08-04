//Express
const express = require('express');
const app = express();
const server = require("http").createServer(app);
const io = require("socket.io").listen(server); //PORT
const port = process.env.PORT || 4000;
const hostname = "192.168.0.117";
server.listen(port, hostname, () => {
  console.log("Server Running on port " + hostname + ":" + port);
});

//modules
const Joi = require("joi");
const bodyParser = require("body-parser");
const path = require("path");

//configure Express
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname + "/views"));

//middlewares
app.use(express.static("assets", ["js", "css", "png", "jpg", "gif"]));
app.use(express.static("views", ["ejs"]));
app.use(express.static('bower_components', ['js', 'css']));
app.use(bodyParser.urlencoded({
    extended: true
}));

//data storage
const nicknames = [];
const oUsers = [];
const supportManagers = [];

const mysql = require('mysql');

const con = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '123456',
    database: 'mmcm'
});

con.connect(function(err) {
  if (err) {
    console.log('error: ' + err.message);
  }
 
  console.log('Connected to the MySQL server.');
});

//routes
// const webRoutes = require('./routes/web')(app, express);
// app.use('/api', require('./routes/api'));
// app.use(webRoutes);

io.sockets.on('connection', (socket) => {
    // console.log(io.sockets.sockets);

    socket.emit('need_info', {socket_id: socket.id});

    socket.on('my_info', (info) => {
        socket.user_id = info.user_id;
        socket.nickname = info.username;
        socket.group = info.group;
        if( info.group == 'user' ) {
            socket.join('room_' + info.user_id);
        }
        console.log(socket);
    });

    //get unaccepted message list for support manager
    socket.on('get new msg list', (callback) => {
        getUnAcceptedList((data) => {
            io.sockets.sockets['admin'].emit('unaccepted list', data);
            callback(data);
        });
    });

    socket.on('send_message', (data) => {
        var message = {user_id: socket.user_id, message: data.msg, receiver_id: parseInt(data.receiver), status:0}
        
        //save to database
        con.query('INSERT INTO mmcm_chats SET ?', message, (err, rows) => {
            if(err == null ){
                console.log('new message sent 0');
                const resp = {name: socket.nickname, msg: data.msg, id: message.user_id, receiver: message.receiver_id, socket_id: socket.id};
                io.sockets.in('room_' + socket.user_id).emit('chat_message', resp);
                // io.sockets.emit('new_message_' + message.user_id, resp);
                // io.sockets.emit('reply_message_' + message.receiver_id, {name: socket.nickname, msg: data.msg, id: message.user_id, receiver: message.receiver_id, socket_id: socket.id});
            } else {
                console.log('new message sent err' + err);
                socket.emit('bug reporting', err);
            }
        });
        if( message.receiver_id == 0 ) {
            getUnAcceptedList((data) => {
                io.sockets.emit('unaccepted list', data);
            });
        }
    });

    socket.on('reply_message', (data) => {
        var message = {user_id: socket.user_id, message: data.msg, receiver_id: parseInt(data.receiver)};
        //save to database
        con.query('INSERT INTO mmcm_chats SET ?', message, (err, rows) => {
            if(err == null ){
                console.log('new message sent 0');
                const resp = {name: socket.nickname, msg: data.msg, id: message.user_id, receiver: message.receiver_id, socket_id: socket.id};
                io.sockets.in('room_' + socket.user_id).emit('chat_message', resp);
                // io.sockets.emit('new_message_' + message.user_id, resp);
                // io.sockets.emit('reply_message_' + message.receiver_id, {name: socket.nickname, msg: data.msg, id: message.user_id, receiver: message.receiver_id, socket_id: socket.id});
            } else {
                console.log('new message sent err' + err);
                socket.emit('bug reporting', err);
            }
        });
        console.log('this is reply message');
    });

    socket.on('join_chat', (data) => {
        let id = data.id;
        socket.join('room_' + data.id);
        console.log('agent joind the room');
        let message = {receiver_id: socket.user_id}
        // io.broadcust.to(io.sockets.sockets[id]).emit('agent_join', {agent_id: socket.user_id, agent_name: socket.nickname});
        con.query('UPDATE mmcm_chats SET receiver_id=' + socket.user_id + ' WHERE user_id=' + id + ' AND receiver_id=0', (err, rows) => {
            if(err == null ) {
                console.log('Support agent join to chat');
                getUnAcceptedList((data) => {
                    io.sockets.emit('unaccepted list', data);
                });
            } else {
                console.log('agent join error - ' + err);
                socket.emit('bug reporting', err);
            }
        });
    });

    socket.on('end_chat', (data) => {
        // io.sockets.emit('');
    });

    socket.on('send_message_' + socket.user_id, (data) => {
        console.log(data);
        var message = {user_id: socket.user_id, message: data.msg, receiver_id: data.receiver}
        //save to database
        con.query('INSERT INTO mmcm_chats SET ?', message, (err, rows) => {
            if(err == null ) {
                console.log('new message sent');
                io.sockets.emit('new_message_' + data.receiver, {name: socket.nickname, msg: data.msg, id: message.user_id, receiver: message.receiver_id, socket_id: socket.id});
            } else {
                console.log('new message sent err' + err);
                socket.emit('bug reporting', err);
            }
        });
    });

    socket.on('reply_message', (data) => {
        console.log(data);
        var message = {user_id: socket.user_id, message: data.msg, receiver_id: data.receiver}
        //save to database
        con.query('INSERT INTO mmcm_chats SET ?', message, (err, rows) => {
            if(err == null ){
                console.log('new message sent');
                io.sockets.emit('new_message_' + data.receiver, {name: socket.nickname, msg: data.msg, id: message.user_id, receiver: message.receiver_id, socket_id: socket.id});
                socket.emit('reply_message_' + data.sender, {name: socket.nickname, msg: data.msg, id: message.user_id, receiver: message.receiver_id, socket_id: socket.id});
            } else {
                console.log('new message sent err' + err);
                socket.emit('bug reporting', err);
            }
        });
    });

    socket.on('get old messages', (data) => {
        let receiver_id = socket.user_id;
        let sender_id = data.id;

        // console.log('Receiver ID : ' + receiver_id + 'Sender : ' + sender_id);
        con.query(
      "SELECT mmcm_chats.id, mmcm_chats.message, mmcm_chats.sending_at, mmcm_chats.user_id as sender_id, S.username as sender_name, R.username as receiver_name FROM mmcm_chats LEFT JOIN users as S ON mmcm_chats.user_id=S.id LEFT JOIN users R ON mmcm_chats.receiver_id=R.id WHERE mmcm_chats.user_id="+ receiver_id +" OR mmcm_chats.receiver_id="+receiver_id+" ORDER BY mmcm_chats.id desc LIMIT 8",
      (err, rows) => {
        console.log( rows );
            if( err == null ) {
                let data = rows;
                socket.emit("old messages", data);
            } else {
                socket.emit('bug reporting', err);
            }
        });
    });

    socket.on('responded_to_msg', (data) => {
        console.log(data);
    });

    socket.on('disconnect', (data) => {
        // if (!socket.user_id) return;
        //remove nickname of disconnected user
        // nicknames.delete(nicknames[socket.nickname]);
        // delete nicknames[socket.nickname];
        for( let i = 0; i < nicknames.length; i++ ) {
            if( nicknames[i].user_id == socket.user_id){
                nicknames.splice(i, 1);
            }
        }

        io.sockets.emit('user left', { name: socket.nickname, id: socket.user_id });
    });
});

function getUnAcceptedList(callback) {
    con.query(
      "SELECT mmcm_chats.id, mmcm_chats.message, mmcm_chats.sending_at, mmcm_chats.user_id as sender_id, S.username as sender_name FROM mmcm_chats LEFT JOIN users as S ON mmcm_chats.user_id=S.id WHERE mmcm_chats.receiver_id='0' GROUP BY mmcm_chats.user_id LIMIT 10",
      (err, rows) => {
        console.log( rows );
            if( err == null ) {
                let data = rows;
                console.log(data);
                // socket.emit('unaccepted list', data);
                callback(data);
            } else {
                // socket.emit('bug reporting', err);
            }
        });
}

function validate(data) {
    const schema = {
        name: Joi.string()
            .min(6)
            .required()
    };
    const result = Joi.validate(data, schema);
    // console.log(result);
    if (result.error)
        return result.error.details[0].message;
}

function getSocket( userId ) {

    return io.sockets.sockets[userId];
    // scht.broadcust.to(sock.socket.id).emit('agent_join', msg);
}

// function userExist( user_id ){ //q, VARIABLE FROM THE INPUT FIELD
//   var k = false;

//    //LOOPS THRU THE ARRAY TO CHECK IF THE KEY EXISTS
//   for(i=0; i<nicknames.length; i++){
//     if(q==nick[i]){
//       k = "true";
//     }
//   }
//   $("#k").html(k); //SHOWS EITHER "TRUE" OF "FALSE"
// }
