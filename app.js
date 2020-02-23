//Express
const express = require('express');
const app = express();
const server = require("http").createServer(app);
const io = require("socket.io").listen(server); //PORT
const port = 4000;
const hostname = "192.168.0.125";
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
const con  = mysql.createPool({
  connectionLimit : 10,
  host            : 'localhost',
  user            : 'root',
  password        : '123456',
  database        : 'dpe'
});
// const con = null;
// pool.getConnection(function(err, connection) {
 
//   console.log('Connected to the MySQL server.');
//   con = connection;
// });
// const con = mysql.createConnection({
//     host: 'localhost',
//     user: 'root',
//     password: '123456',
//     database: 'dpe'
// });

// con.connect(function(err) {
//   if (err) {
//     console.log('error: ' + err.message);
//   }
 
//   console.log('Connected to the MySQL server.');
// });

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
            socket.room = 'room_' + info.user_id;
        } else {
            socket.join('ajent_room');
            getUnAcceptedList((data) => {
                console.log(data);
                io.sockets.in('ajent_room').emit('pending_list', data);
            });

            getAcceptedList((data) => {
                console.log( data );
                socket.emit('joined_list', data);
            }, socket);
        }
        console.log('my info set');
    });

    socket.on('send_message', (data) => {
        console.log(data);
        if( data.receiver_id == 0 ) {
            //save to database
            con.query('INSERT INTO live_supports SET ?', {user_id: socket.user_id, message: data.msg, ajent_id: 0}, (err, rows) => {
                if(err != null ) {
                    console.log('new message sent err' + err);
                    // socket.emit('bug reporting', err);
                }
            });

            //update all pending list
            getUnAcceptedList((data) => {
                io.sockets.in('ajent_room').emit('pending_list', data);
            });
        } else {
            con.query('INSERT INTO live_support_replies SET ?', {live_support_id: 1, sender_id: socket.user_id, message: data.msg, receiver_id: data.receiver}, (err, rows) => {
                if(err != null ) {
                    console.log('new message sent err' + err);
                    // socket.emit('bug reporting', err);
                }
            });
        }

        //Send message to socket
        const resp = {name: socket.nickname, msg: data.msg, sender: socket.user_id, receiver: data.receiver_id, socket_id: socket.id};
        io.sockets.emit('chat_message', resp);

        // io.sockets.emit('new_message_' + message.user_id, resp);
        // io.sockets.emit('reply_message_' + message.receiver_id, {name: socket.nickname, msg: data.msg, id: message.user_id, receiver: message.receiver_id, socket_id: socket.id});
    });

    socket.on('reply_message', (data) => {
        var message = {user_id: parseInt(data.sender), message: data.msg, receiver_id: parseInt(data.receiver)};
        //save to database
        con.query('INSERT INTO mmcm_chats SET ?', message, (err, rows) => {
            if(err == null ){
                console.log('new message sent 0');
                var today = new Date();
                var time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
                const resp = {name: socket.nickname, msg: data.msg, sender: message.receiver_id, receiver: message.user_id, socket_id: socket.id, time:time };
                io.sockets.emit('chat_message', resp);
                // io.sockets.emit('new_message_' + message.user_id, resp);
                // io.sockets.emit('reply_message_' + message.receiver_id, {name: socket.nickname, msg: data.msg, id: message.user_id, receiver: message.receiver_id, socket_id: socket.id});
            } else {
                console.log('new message sent err' + err);
                socket.emit('bug reporting', err);
            }
        });
    });

    socket.on('join_chat', (data) => {
        let id = data.id;
        var today = new Date();
        var time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
        socket.join('room_' + data.id);
        socket.room = 'room_' + data.id;
        let message = {receiver_id: socket.user_id}
        // io.broadcust.to(io.sockets.sockets[id]).emit('agent_join', {agent_id: socket.user_id, agent_name: socket.nickname});
        con.query('UPDATE live_supports SET agent_id=' + socket.user_id + ', status=1 WHERE id=' + id, (err, rows) => {
            if(err == null ) {
                console.log('Support agent join to chat');
                io.sockets.in('room_' + data.id).emit('agent_join', {agent_id: socket.user_id, agent_name: socket.nickname, time: rows.sending_at});
                var msg = 'আপনাকে কিভাবে সহযোগিতা করতে পারি?';
                const resp = {name: socket.nickname, msg: msg, id: socket.user_id, receiver: socket.user_id, socket_id: socket.id, time:time };
                io.sockets.in('room_' + data.receiver).emit('chat_message', resp);
                getUnAcceptedList((data) => {
                    io.sockets.emit('pending_list', data);
                });
            } else {
                console.log('agent join error - ' + err);
                // socket.emit('bug reporting', err);
            }
        });
    });

    socket.on('end_chat', (data) => {
        io.sockets.in('room_' + data.id).emit('end_chat', {status: true, msg: 'Your session has ended by operator.'});
    });

    socket.on('send_message_' + socket.user_id, (data) => {
        // console.log(data);
        var message = {user_id: socket.user_id, message: data.msg, receiver_id: data.receiver}
        //save to database
        con.query('INSERT INTO mmcm_chats SET ?', message, (err, rows) => {
            if(err == null ) {
                console.log('new message sent');

                var today = new Date();
                var time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
                io.sockets.emit('new_message_' + data.receiver, {name: socket.nickname, msg: data.msg, id: message.user_id, receiver: message.receiver_id, socket_id: socket.id, time: time});
            } else {
                console.log('new message sent err' + err);
                socket.emit('bug reporting', err);
            }
        });
    });

    socket.on('get old messages', (data) => {
        let receiver_id = socket.user_id;
        let sender_id = data.id;

        console.log('Receiver ID : ' + receiver_id + 'Sender : ' + sender_id);

        con.query(
      "SELECT mmcm_chats.id, mmcm_chats.message, mmcm_chats.sending_at, mmcm_chats.user_id as sender_id, S.name_bn as sender_name, R.name_bn as receiver_name FROM mmcm_chats LEFT JOIN users as S ON mmcm_chats.user_id=S.id LEFT JOIN users R ON mmcm_chats.receiver_id=R.id WHERE mmcm_chats.user_id="+ receiver_id +" OR mmcm_chats.receiver_id="+receiver_id+" ORDER BY mmcm_chats.id desc LIMIT 8",
      (err, rows) => {
        console.log( rows );
            if( err == null ) {
                console.log(rows);
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
        // for( let i = 0; i < nicknames.length; i++ ) {
        //     if( nicknames[i].user_id == socket.user_id){
        //         nicknames.splice(i, 1);
        //     }
        // }

        // con.end(function (err) {
        //   console.log('connection disconnected!');
        // });

        io.sockets.in(socket.room).emit('user_left', { name: socket.nickname, id: socket.user_id });
    });
});

function getUnAcceptedList(callback) {
    con.query(
      "SELECT live_supports.*, users.name_bn as sender_name FROM live_supports LEFT JOIN users on live_supports.user_id=users.id WHERE agent_id=0",
      (err, rows) => {
            if( err == null ) {
                console.log( rows );
                callback(rows);
            }
        });
}

function getAcceptedList( callback, socket ) {
    con.query(
      "SELECT live_supports.*, users.name_bn as sender_name FROM live_supports LEFT JOIN users on live_supports.user_id=users.id WHERE status=1 AND agent_id="+ socket.user_id,
      (err, rows) => {
            if( err == null ) {
                console.log( rows );
                callback(rows);
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

