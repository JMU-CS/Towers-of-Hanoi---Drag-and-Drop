const PORT = process.env.PORT || 80
var express = require('express')
var app = express()
var http = require('http').createServer(app)
var io = require('socket.io')(http)

app.use(express.static('client'))

const CLIENT_TO_ROOM = {}
const GAME_ROOM_TO_GAME_INFO = {}
var SOLO = []

io.on('connection', function (socket) {
  console.log('a user connected')

  socket.on('disconnect', reason => {
    console.log('disconnect', 'socket.id', socket.id)
    if (socket.id in CLIENT_TO_ROOM && CLIENT_TO_ROOM[socket.id] in GAME_ROOM_TO_GAME_INFO && 'clients' in GAME_ROOM_TO_GAME_INFO[CLIENT_TO_ROOM[socket.id]]) {
      console.log(CLIENT_TO_ROOM[socket.id], 'user disconnected', socket.id)
      GAME_ROOM_TO_GAME_INFO[CLIENT_TO_ROOM[socket.id]].clients = GAME_ROOM_TO_GAME_INFO[CLIENT_TO_ROOM[socket.id]].clients.filter(id => id !== socket.id)
    } else {
      console.log('user disconnected', socket.id)
    }
    SOLO = SOLO.filter(elem => elem !== CLIENT_TO_ROOM[socket.id])
    delete CLIENT_TO_ROOM[socket.id]
  })

  socket.on('game-info', function (info) {
    console.log('game-info', 'socket.id', socket.id)
    console.log(info.gameid, 'game-info')
    // if this person was in another game, drop them from it
    if (socket.id in CLIENT_TO_ROOM) {
      if (CLIENT_TO_ROOM[socket.id] in GAME_ROOM_TO_GAME_INFO && 'clients' in GAME_ROOM_TO_GAME_INFO[CLIENT_TO_ROOM[socket.id]] && GAME_ROOM_TO_GAME_INFO[CLIENT_TO_ROOM[socket.id]].gameid !== info.gameid) {
        GAME_ROOM_TO_GAME_INFO[CLIENT_TO_ROOM[socket.id]].clients = GAME_ROOM_TO_GAME_INFO[CLIENT_TO_ROOM[socket.id]].clients.filter(id => id !== socket.id)
        console.log('remove user from old room')
        SOLO = SOLO.filter(elem => elem !== CLIENT_TO_ROOM[socket.id])
        delete CLIENT_TO_ROOM[socket.id]
      }
    }
    if (!(info.gameid in GAME_ROOM_TO_GAME_INFO)) { // not attempting to join a known game. join rando, or create new
      console.log('not attempting to join a known game. join rando, or create new')
      let joinExisting = false
      var possibleJoin
      while (SOLO.length > 0 && !joinExisting) { // look for rando to join
        possibleJoin = GAME_ROOM_TO_GAME_INFO[SOLO.shift()]
        if (possibleJoin.moves === 0) {
          joinExisting = true
        }
      }
      if (joinExisting) { // rando found; join
        console.log('rando found; join', possibleJoin.gameid)
        socket.emit('start-state', GAME_ROOM_TO_GAME_INFO[possibleJoin.gameid])
        GAME_ROOM_TO_GAME_INFO[possibleJoin.gameid].clients.push(socket.id)
        CLIENT_TO_ROOM[socket.id] = possibleJoin.gameid
        socket.join(possibleJoin.gameid)
      } else { // rando not found; create
        console.log('rando not found; create new room', info.gameid)
        GAME_ROOM_TO_GAME_INFO[info.gameid] = info
        GAME_ROOM_TO_GAME_INFO[info.gameid].moves = 0
        GAME_ROOM_TO_GAME_INFO[info.gameid].clients = [socket.id]
        SOLO.push(info.gameid)
        socket.join(info.gameid)
        CLIENT_TO_ROOM[socket.id] = info.gameid
      }
    } else {
      console.log('attempting to join an existing/known game')
      if (GAME_ROOM_TO_GAME_INFO[info.gameid].difficulty === info.difficulty) {
        console.log('difficulty matches')
        if ('state' in GAME_ROOM_TO_GAME_INFO[info.gameid]) {
          socket.emit('start-state', GAME_ROOM_TO_GAME_INFO[info.gameid])
        }
      } else {
        console.log('ERROR difficulty mismatch')
        socket.emit('difficulty-correction', GAME_ROOM_TO_GAME_INFO[info.gameid])
      }
      GAME_ROOM_TO_GAME_INFO[info.gameid].clients.push(socket.id)
      CLIENT_TO_ROOM[socket.id] = info.gameid
      socket.join(info.gameid)
    }
  })

  socket.on('start', function (info) {
    console.log('start', 'socket.id', socket.id)
    // console.log('start')
    socket.to(CLIENT_TO_ROOM[socket.id]).emit('start', info)
  })

  socket.on('drag', function (info) {
    // console.log('drag', 'socket.id', socket.id)
    // console.log('drag')
    socket.to(CLIENT_TO_ROOM[socket.id]).emit('drag', info)
  })

  socket.on('stop', function (info) {
    console.log("'stop', ", 'socket.id', socket.id)
    // console.log('stop')
    socket.to(CLIENT_TO_ROOM[socket.id]).emit('stop', info)
  })

  socket.on('new-state', function (newState) {
    console.log('new-state socket.id: ', socket.id)
    console.log('CLIENT_TO_ROOM', CLIENT_TO_ROOM)
    console.log(CLIENT_TO_ROOM)
    console.log(CLIENT_TO_ROOM[socket.id], 'new-state', newState)
    GAME_ROOM_TO_GAME_INFO[CLIENT_TO_ROOM[socket.id]].state = newState
    GAME_ROOM_TO_GAME_INFO[CLIENT_TO_ROOM[socket.id]].moves++
    socket.to(CLIENT_TO_ROOM[socket.id]).emit('moves', { moves: GAME_ROOM_TO_GAME_INFO[CLIENT_TO_ROOM[socket.id]].moves })
  })
  socket.on('request-reset', (info) => {
    console.log('request-reset', 'socket.id', socket.id)
    console.log(CLIENT_TO_ROOM[socket.id], 'request-reset')
    if (GAME_ROOM_TO_GAME_INFO[CLIENT_TO_ROOM[socket.id]].clients.length === 1) {
      delete GAME_ROOM_TO_GAME_INFO[CLIENT_TO_ROOM[socket.id]].state
      GAME_ROOM_TO_GAME_INFO[CLIENT_TO_ROOM[socket.id]].moves = 0
      socket.emit('reset')
    }
    GAME_ROOM_TO_GAME_INFO[CLIENT_TO_ROOM[socket.id]].resetKey = info.resetKey
    socket.to(CLIENT_TO_ROOM[socket.id]).emit('request-reset', {
      resetKey: info.resetKey
    })
  })

  socket.on('do-reset', (info) => {
    console.log('do-reset', 'socket.id', socket.id)
    console.log(CLIENT_TO_ROOM[socket.id], 'do-reset')
    if (GAME_ROOM_TO_GAME_INFO[CLIENT_TO_ROOM[socket.id]].resetKey === info.resetKey) {
      delete GAME_ROOM_TO_GAME_INFO[CLIENT_TO_ROOM[socket.id]].state
      GAME_ROOM_TO_GAME_INFO[CLIENT_TO_ROOM[socket.id]].moves = 0
      socket.to(CLIENT_TO_ROOM[socket.id]).emit('reset')
    }
  })
})

http.listen(PORT, function () {
  console.log(`listening on *:${PORT}`)
})
