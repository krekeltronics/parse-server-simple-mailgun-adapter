/* eslint-env jasmine */
var nock = require('nock')
var mailgunAdapter = require('../index')

nock.disableNetConnect()

var encodeQueryParams = (params) => {
  return Object.keys(params).map(key => {
    return encodeURIComponent(key) + '=' + encodeURIComponent(params[key])
  }).join('&')
}

describe('Mailgun adapter', () => {
  var mailOptions
  var adapter
  var html

  beforeEach(() => {
    mailOptions = {
      from: 'noreply@example.com',
      to: 'test@example.com',
      subject: 'my test',
      text: 'Hello,\nThanks for your interest!'
    }

    adapter = mailgunAdapter({
      apiKey: process.env.MAILGUN_API_KEY,
      domain: process.env.MAILGUN_API_DOMAIN,
      fromAddress: 'noreply@example.com'
    })

    html = '<html><head></head><body><p>' + mailOptions.text + '</p></body></html>'

    nock('https://api.mailgun.net:443', {encodedQueryParams: true})
      .post('/v3/' + process.env.MAILGUN_API_DOMAIN + '/messages', encodeQueryParams(mailOptions))
      .reply(200, {id: 'send-text-message', message: 'Queued. Thank you.'})
      .post('/v3/' + process.env.MAILGUN_API_DOMAIN + '/messages.mime', new RegExp(html.replace('/', '\/')))
      .reply(200, {id: 'send-mime-message', message: 'Queued. Thank you.'})
  })

  it('sends plain text message', (done) => {
    adapter.sendMail(mailOptions).then((response) => {
      expect(response.id).toEqual('send-text-message')
      done()
    }).catch(function (error) {
      fail(error)
      done()
    })
  })

  it('sends MIME message', (done) => {
    mailOptions.mime = true
    mailOptions.html = html
    adapter.sendMail(mailOptions).then((response) => {
      expect(response.id).toEqual('send-mime-message')
      done()
    }).catch(function (error) {
      fail(error)
      done()
    })
  })
})
