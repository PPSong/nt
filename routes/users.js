var express = require('express')
var router = express.Router()
const passport = require('passport')
const jwt = require('jsonwebtoken')
const {User} = require('../models/models')

/* GET users listing. */
router.get('/', function (req, res, next) {
  res.send('respond with a resource')
})

const secret = '7x0jhxt"9(thpX6'

router.post('/login', async function (req, res, next) {
  req.assert('_id', 'required').notEmpty()
  req.assert('password', 'required').notEmpty()

  let validateError = await req.getValidationResult()

  if (!(validateError.isEmpty())) {
    return res
      .status(400)
      .json({error: validateError.array()})
  }

  passport.authenticate('local', function (err, user, info) {
    if (err) {
      return next(err)
    }

    console.log('login1')
    if (!user) {
      return res.status(401).json({error: info})
    }

    console.log('login2')
    if (user) {
      const token = jwt.sign({id: user._id, loginTime: user.loginTime}, secret)
      return res
        .status(200)
        .json({
          _id: user._id,
          nickname: user.nickname,
          token: token,
          avatar: user.avatar,
          sex: user.sex
        })
    }
  })(req, res, next)
})

router.post('/register', async function (req, res, next) {
  req.assert('_id', 'required').notEmpty()
  req.assert('password', 'required').notEmpty()

  let validateError = await req.getValidationResult()

  if (!(validateError.isEmpty())) {
    return res
      .status(400)
      .json({error: validateError.array()})
  }

  passport.authenticate('local-signup', function (err, user, info) {
    if (err) {
      return next(err)
    }
    if (!user) {
      return res.status(401).json({error: info})
    }
    if (user) {
      const token = jwt.sign({id: user._id, loginTime: user.loginTime}, secret)
      return res
        .status(200)
        .json({
          _id: user._id,
          nickname: user.nickname,
          token: token,
          avatar: user.avatar,
          sex: user.sex
        })
    }
  })(req, res, next)
})

module.exports = router
