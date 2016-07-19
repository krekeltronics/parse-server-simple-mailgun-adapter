/* eslint-env jasmine */
var nock = require('nock')
var mailgunAdapter = require('../index')
var ejs = require('ejs')

nock.disableNetConnect()

var encodeQueryParams = (params) => {
  return Object.keys(params).map(key => {
    return encodeURIComponent(key) + '=' + encodeURIComponent(params[key])
  }).join('&')
}

describe('Mailgun adapter', () => {
  var mailOptions
  var html

  beforeEach(() => {
    mailOptions = {
      from: 'noreply@example.com',
      to: 'test@example.com',
      subject: 'my test',
      text: 'Hello,\nThanks for your interest!'
    }
    html = '<html><head></head><body><p>' + mailOptions.text + '</p></body></html>'
  })

  describe('sending plain text', () => {
    it('sends plain text message', (done) => {
      nock('https://api.mailgun.net:443', {encodedQueryParams: true})
        .post('/v3/' + process.env.MAILGUN_API_DOMAIN + '/messages', encodeQueryParams(mailOptions))
        .reply(200, {id: 'send-text-message', message: 'Queued. Thank you.'})

      mailgunAdapter({
        apiKey: process.env.MAILGUN_API_KEY,
        domain: process.env.MAILGUN_API_DOMAIN,
        fromAddress: 'noreply@example.com'
      }).sendMail(mailOptions).then((response) => {
        expect(response.id).toEqual('send-text-message')
        done()
      }).catch(function (error) {
        fail(error)
        done()
      })
    })
  })

  describe('sending MIME', () => {
    it('sends MIME message', (done) => {
      nock('https://api.mailgun.net:443', {encodedQueryParams: true})
        .post('/v3/' + process.env.MAILGUN_API_DOMAIN + '/messages.mime', new RegExp(html.replace('/', '\/')))
        .reply(200, {id: 'send-mime-message', message: 'Queued. Thank you.'})

      mailOptions.mime = true
      mailOptions.html = html
      mailgunAdapter({
        apiKey: process.env.MAILGUN_API_KEY,
        domain: process.env.MAILGUN_API_DOMAIN,
        fromAddress: 'noreply@example.com',
        mime: true
      }).sendMail(mailOptions).then((response) => {
        expect(response.id).toEqual('send-mime-message')
        done()
      }).catch(function (error) {
        fail(error)
        done()
      })
    })
  })

  describe('when sending password reset email', () => {
    var sendPasswordResetEmail

    beforeEach(() => {
      var template = 'Hi,\n\n' +
        'You requested to reset your password for <%= appName %>.\n\n' +
        'Click here to reset it:\n<%= link %>'

      sendPasswordResetEmail = function (options) {
        var body = ejs.render(template, options)
        var data = {
          from: this.fromAddress,
          to: options.user.get('email'),
          subject: 'Password Reset for ' + options.appName,
          text: body
        }
        return this.sendMail(data)
      }
    })

    it('sends plain text message', (done) => {
      nock('https://api.mailgun.net:443', {encodedQueryParams: true})
        .post('/v3/' + process.env.MAILGUN_API_DOMAIN + '/messages', encodeQueryParams({
          from: 'noreply@example.com',
          to: 'my-email',
          subject: 'Password Reset for my-app-name',
          text: 'Hi,\n\n' +
            'You requested to reset your password for my-app-name.\n\n' +
            'Click here to reset it:\nmy-link'
        }))
        .reply(200, {id: 'send-password-reset-text-message', message: 'Queued. Thank you.'})

      mailgunAdapter({
        apiKey: process.env.MAILGUN_API_KEY,
        domain: process.env.MAILGUN_API_DOMAIN,
        fromAddress: 'noreply@example.com',
        sendPasswordResetEmail: sendPasswordResetEmail
      }).sendPasswordResetEmail({
        link: 'my-link',
        user: {
          email: 'my-email',
          get: function (key) { return this[key] }
        },
        appName: 'my-app-name'
      }).then(response => {
        expect(response.id).toEqual('send-password-reset-text-message')
        done()
      }).catch(error => {
        fail(error)
        done()
      })
    })
  })
})
