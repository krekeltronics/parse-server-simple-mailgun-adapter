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

var regExpForHtmlContent = (html) => {
  return new RegExp(html.replace('/', '\/'))
}

describe('Mailgun adapter', () => {
  var mailOptions

  describe('when sending a simple message', () => {
    beforeEach(() => {
      mailOptions = {
        from: 'noreply@example.com',
        to: 'test@example.com',
        subject: 'my test',
        text: 'Hello,\nThanks for your interest!'
      }
    })

    it('sends plain text', (done) => {
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

    it('sends MIME', (done) => {
      mailOptions.mime = true
      mailOptions.html = '<html><head></head><body><p>' + mailOptions.text + '</p></body></html>'

      nock('https://api.mailgun.net:443', {encodedQueryParams: true})
        .post('/v3/' + process.env.MAILGUN_API_DOMAIN + '/messages.mime', regExpForHtmlContent(mailOptions.html))
        .reply(200, {id: 'send-mime-message', message: 'Queued. Thank you.'})

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
