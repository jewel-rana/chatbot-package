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

    //get unaccepted message list for support manager
    socket.on('get new msg list', (callback) => {
        getUnAcceptedList(socket, callback);
    });

    //add users
    socket.on('new user', (data, callback) => {
        console.log(nicknames.length);
        var userHas = false;
        if( nicknames.length > 0 && typeof nicknames !='undefined' ) {
            for( var i = 0; i < nicknames.length; i++ ) {
                if( parseInt( nicknames[i].id ) === parseInt(data.id) ){
                    console.log('testing');
                    userHas = true;
                }
            }
        }

        console.log(userHas);

        if (userHas == true) {
            console.log('User already exist' + userHas);
            socket.user_id = data.id;
            socket.nickname = data.name;
            callback(false);
        } else {
            socket.user_id = data.id;
            socket.nickname = data.name;
            nicknames.push({name: socket.nickname, id: data.id, socket: socket});

            callback(true);
        }
        //new user join
        io.sockets.emit("user join", socket.nickname);

        socket.emit('online', supportManagers.length);

        // updateNickenames(socket);
    });

    socket.on('send_message', (data) => {
        var message = {user_id: socket.user_id, message: data.msg, receiver_id: parseInt(data.receiver)}
        //save to database
        con.query('INSERT INTO mmcm_chats SET ?', message, (err, rows) => {
            if(err == null ){
                console.log('new message sent 0');
                io.sockets.emit('new_message_' + message.user_id, {name: socket.nickname, msg: data.msg, id: message.user_id, receiver: message.receiver_id, socket_id: socket.id});
                io.sockets.emit('reply_message_' + message.receiver_id, {name: socket.nickname, msg: data.msg, id: message.user_id, receiver: message.receiver_id, socket_id: socket.id});
            } else {
                console.log('new message sent err' + err);
                socket.emit('bug reporting', err);
            }
        });
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
        updateNickenames(socket);
    });
});

function getUnAcceptedList(socket, callback) {
    con.query(
      "SELECT mmcm_chats.id, mmcm_chats.message, mmcm_chats.sending_at, mmcm_chats.user_id as sender_id, S.username as sender_name FROM mmcm_chats LEFT JOIN users as S ON mmcm_chats.user_id=S.id WHERE mmcm_chats.receiver_id='0' GROUP BY mmcm_chats.user_id LIMIT 10",
      (err, rows) => {
        console.log( rows );
            if( err == null ) {
                let data = rows;
                console.log(data);
                socket.emit('unaccepted list', data);
            } else {
                socket.emit('bug reporting', err);
            }
        });
}

function updateNickenames(socket) {
    const oUsers = [];
    for( var i = 0; i < nicknames.length; i++ ) {
        oUsers.push( {name: nicknames[i].name, socket_id: nicknames[i].socket.id, user_id: nicknames[i].id } );
    }
    // console.log(oUsers);
    io.sockets.emit('users', oUsers);
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