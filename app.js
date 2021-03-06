var express = require('express')
var path = require('path')
var favicon = require('serve-favicon')
var logger = require('morgan')
var cookieParser = require('cookie-parser')
var bodyParser = require('body-parser')

var mongoose = require('mongoose')
var passport = require('passport')
var LocalStrategy = require('passport-local').Strategy
var JwtStrategy = require('passport-jwt').Strategy
var ExtractJwt = require('passport-jwt').ExtractJwt

var index = require('./routes/index')
var users = require('./routes/users')

var {User} = require('./models/models')
var expressValidator = require('express-validator')

var app = express()

var server = require('http').createServer(app)
var io = require('socket.io')(server)

global.clients = {}

io.on('connection', function (socket) {
  console.log('user ' + socket.id + ' connected')
  socket.on('disconnect', function () {
    console.log('user' + socket.id + ' disconnected')
    for (key in global.clients) {
      if (global.clients[key].id == socket.id) {
        delete global.clients[key]
        break
      }
    }
    console.log(Object.keys(global.clients))
  })

  socket.emit('needYourUserId', {need: 'your userId'})
  socket.on('giveMyUserId', function (userId) {
    global.clients[userId] = socket
    console.log(Object.keys(global.clients))
  })

  socket.on('heartBeat', function (_id) {
    console.log(_id)
  })
})
server.listen(3001)

// JWT configration
var options = {}
options.jwtFromRequest = ExtractJwt.fromAuthHeaderWithScheme('jwt')
options.secretOrKey = '7x0jhxt"9(thpX6'

app.use(passport.initialize())

// view engine setup
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'jade')

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'))
app.use(bodyParser.json())
app.use(expressValidator()) // this line must be immediately after any of the bodyParser middlewares!
app.use(bodyParser.urlencoded({extended: false}))
app.use(cookieParser())
app.use(express.static(path.join(__dirname, 'public')))

// Configure Passport to use local strategy for initial authentication.
passport.use('local', new LocalStrategy({
    usernameField: '_id',
    passReqToCallback: true
  },
  async function (req, _id, password, done) {
    try {
      console.log('local jwt:')
      let user = await User.findOne({
        _id: _id
      })

      if (!user) {
        return done(null, false, 'No user found.')
      }

      if (!user.validPassword(password)) {
        return done(null, false, 'Oops! Wrong password.')
      }

      user.loginTime = Date.now()
      await user.save()

      return done(null, user)

    } catch (err) {
      console.log('local error:')
      console.log(err)
      return done(err)
    }
  }))

passport.use('local-signup', new LocalStrategy({
    // by default, local strategy uses username and password, we will override with email
    usernameField: '_id',
    passReqToCallback: true // allows us to pass back the entire request to the callback
  },
  function (req, _id, password, done) {
    console.log('local-signup jwt:')
    // asynchronous
    // User.findOne wont fire unless data is sent back
    process.nextTick(function () {

      // find a user whose email is the same as the forms email
      // we are checking to see if the user trying to login already exists
      User.findOne({_id: _id}, function (err, user) {
        // if there are any errors, return the error
        if (err)
          return done(err)

        // check to see if theres already a user with that email
        if (user) {
          return done(null, false, 'That email is already taken.')
        } else {

          // if there is no user with that email
          // create the user
          var newUser = new User()

          // set the user's local credentials
          newUser._id = _id
          newUser.nickname = _id + 'n'
          newUser.password = User.generateHash(password)

          // save the user
          newUser.save(function (err) {
            if (err)
              throw err
            return done(null, newUser)
          })
        }
      })
    })
  }))

// Configure Passport to use JWT strategy to look up Users.
passport.use('jwt', new JwtStrategy(options, function (jwt_payload, done) {
  console.log('JwtStrategy:', jwt_payload)
  User.findOne({
    _id: jwt_payload.id,
  }, function (err, user) {
    if (err) {
      return done(err, false)
    }
    if (user) {
      if (user.loginTime != jwt_payload.loginTime) {
        done(null, false, '用户已在别处登录, 请重新登录!')
      } else {
        done(null, user)
      }
    } else {
      done(null, false, '无此用户!')
    }
  })
}))

app.use('/', index)
app.use('/users', users)

// connect to database
var db = process.env.MONGO_URL || 'localhost/JB3'
mongoose.connect(db)
mongoose.connection.on('error', function () {
  console.info('Error: Could not connect to MongoDB. Did you forget to run `mongod`?')
})

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  var err = new Error('Not Found')
  err.status = 404
  next(err)
})

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message
  res.locals.error = req.app.get('env') === 'development' ? err : {}

  // render the error page
  res.status(err.status || 500)
  res.render('error')
})

module.exports = app
