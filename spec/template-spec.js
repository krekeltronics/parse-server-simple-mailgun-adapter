/* eslint-env jasmine */
var nock = require('nock')
var mailgunAdapter = require('../index')
var ejs = require('ejs')

nock.disableNetConnect()

var mailgunAPIKey = process.env.MAILGUN_API_KEY || 'my-api-key'
var mailgunAPIDomain = process.env.MAILGUN_API_DOMAIN || 'my-api-domain'

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
        .post('/v3/' + mailgunAPIDomain + '/messages', encodeQueryParams(mailOptions))
        .reply(200, {id: 'send-text-message', message: 'Queued. Thank you.'})

      mailgunAdapter({
        apiKey: mailgunAPIKey,
        domain: mailgunAPIDomain,
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
        .post('/v3/' + mailgunAPIDomain + '/messages.mime', regExpForHtmlContent(mailOptions.html))
        .reply(200, {id: 'send-mime-message', message: 'Queued. Thank you.'})

      mailgunAdapter({
        apiKey: mailgunAPIKey,
        domain: mailgunAPIDomain,
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
    var passwordResetOptions
    var passwordResetTemplates

    beforeEach(() => {
      passwordResetTemplates = {
        text: ejs.compile('Hi,\n\n' +
          'You requested to reset your password for <%= appName %>.\n\n' +
          'Click here to reset it:\n<%= link %>'),
        html: ejs.compile('<html><head></head><body>\n' +
          '<p>Hi,</p>\n' +
          '<p>You requested to reset your password for <%= appName %>.</p>\n' +
          '<p>Click here to reset it:<br />\n' +
          '<a href="<%= link %>"><%= link %></a></p>\n' +
          '</body></html>')
      }

      passwordResetOptions = {
        link: 'my-link',
        user: {
          email: 'my-email',
          get: function (key) { return this[key] }
        },
        appName: 'my-app-name'
      }

      sendPasswordResetEmail = function (options) {
        var templates = this.passwordResetTemplates
        var data = {
          from: this.fromAddress,
          to: options.user.get('email'),
          subject: 'Password Reset for ' + options.appName,
          text: templates.text(options)
        }

        if (this.mime) {
          data.html = templates.html(options)
        }

        return this.sendMail(data)
      }
    })

    it('sends plain text', (done) => {
      nock('https://api.mailgun.net:443', {encodedQueryParams: true})
        .post('/v3/' + mailgunAPIDomain + '/messages', encodeQueryParams({
          from: 'noreply@example.com',
          to: 'my-email',
          subject: 'Password Reset for my-app-name',
          text: 'Hi,\n\n' +
            'You requested to reset your password for my-app-name.\n\n' +
            'Click here to reset it:\nmy-link'
        }))
        .reply(200, {id: 'send-password-reset-text-message', message: 'Queued. Thank you.'})

      mailgunAdapter({
        apiKey: mailgunAPIKey,
        domain: mailgunAPIDomain,
        fromAddress: 'noreply@example.com',
        sendPasswordResetEmail: sendPasswordResetEmail,
        passwordResetTemplates: passwordResetTemplates
      }).sendPasswordResetEmail(passwordResetOptions).then(response => {
        expect(response.id).toEqual('send-password-reset-text-message')
        done()
      }).catch(error => {
        fail(error)
        done()
      })
    })

    it('sends MIME', (done) => {
      var html = '<html><head></head><body>\n' +
        '<p>Hi,</p>\n' +
        '<p>You requested to reset your password for my-app-name.</p>\n' +
        '<p>Click here to reset it:<br />\n' +
        '<a href="my-link">my-link</a></p>\n' +
        '</body></html>'
      nock('https://api.mailgun.net:443', {encodedQueryParams: true})
        .post('/v3/' + mailgunAPIDomain + '/messages.mime', regExpForHtmlContent(html))
        .reply(200, {id: 'send-password-reset-mime-message', message: 'Queued. Thank you.'})

      mailgunAdapter({
        apiKey: mailgunAPIKey,
        domain: mailgunAPIDomain,
        fromAddress: 'noreply@example.com',
        sendPasswordResetEmail: sendPasswordResetEmail,
        passwordResetTemplates: passwordResetTemplates,
        mime: true
      }).sendPasswordResetEmail(passwordResetOptions).then(response => {
        expect(response.id).toEqual('send-password-reset-mime-message')
        done()
      }).catch(error => {
        fail(error)
        done()
      })
    })
  })

  describe('when sending verification email', () => {
    var sendVerificationEmail
    var verificationOptions
    var verificationTemplates

    beforeEach(() => {
      verificationTemplates = {
        text: ejs.compile('Hi,\n\n' +
          'You signed up for <%= appName %> with this email address: <%= user.get("email") %>.\n\n' +
          'Click here to verify your address:\n<%= link %>'),
        html: ejs.compile('<html><head></head><body>\n' +
          '<p>Hi,</p>\n' +
          '<p>You signed up for <%= appName %> with this email address: <%= user.get("email") %>.</p>\n' +
          '<p>Click here to verify your address:\n' +
          '<a href="<%= link %>"><%= link %></a></p>\n' +
          '</body></html>')
      }

      verificationOptions = {
        link: 'my-link',
        user: {
          email: 'my-email',
          get: function (key) { return this[key] }
        },
        appName: 'my-app-name'
      }

      sendVerificationEmail = function (options) {
        var templates = this.verificationTemplates
        var data = {
          from: this.fromAddress,
          to: options.user.get('email'),
          subject: 'Welcome to ' + options.appName,
          text: templates.text(options)
        }

        if (this.mime) {
          data.html = templates.html(options)
        }

        return this.sendMail(data)
      }
    })

    it('sends plain text', (done) => {
      nock('https://api.mailgun.net:443', {encodedQueryParams: true})
        .post('/v3/' + mailgunAPIDomain + '/messages', encodeQueryParams({
          from: 'noreply@example.com',
          to: 'my-email',
          subject: 'Welcome to my-app-name',
          text: 'Hi,\n\n' +
            'You signed up for my-app-name with this email address: my-email.\n\n' +
            'Click here to verify your address:\nmy-link'
        }))
        .reply(200, {id: 'send-verification-text-message', message: 'Queued. Thank you.'})

      mailgunAdapter({
        apiKey: mailgunAPIKey,
        domain: mailgunAPIDomain,
        fromAddress: 'noreply@example.com',
        sendVerificationEmail: sendVerificationEmail,
        verificationTemplates: verificationTemplates
      }).sendVerificationEmail(verificationOptions).then(response => {
        expect(response.id).toEqual('send-verification-text-message')
        done()
      }).catch(error => {
        fail(error)
        done()
      })
    })

    it('sends MIME', (done) => {
      var html = '<html><head></head><body>\n' +
        '<p>Hi,</p>\n' +
        '<p>You signed up for my-app-name with this email address: my-email.</p>\n' +
        '<p>Click here to verify your address:\n' +
        '<a href="my-link">my-link</a></p>\n' +
        '</body></html>'
      nock('https://api.mailgun.net:443', {encodedQueryParams: true})
        .post('/v3/' + mailgunAPIDomain + '/messages.mime', regExpForHtmlContent(html))
        .reply(200, {id: 'send-verification-mime-message', message: 'Queued. Thank you.'})

      mailgunAdapter({
        apiKey: mailgunAPIKey,
        domain: mailgunAPIDomain,
        fromAddress: 'noreply@example.com',
        sendVerificationEmail: sendVerificationEmail,
        verificationTemplates: verificationTemplates,
        mime: true
      }).sendVerificationEmail(verificationOptions).then(response => {
        expect(response.id).toEqual('send-verification-mime-message')
        done()
      }).catch(error => {
        fail(error)
        done()
      })
    })
  })
})
