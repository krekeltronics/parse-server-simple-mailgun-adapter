var mailcomposer = require('mailcomposer');
var Mailgun = require('mailgun-js');

var SimpleMailgunAdapter = mailgunOptions => {
  var mailgun
  if (!mailgunOptions || !mailgunOptions.fromAddress) {
    throw 'SimpleMailgunAdapter requires a fromAddress';
  }

  if (typeof mailgunOptions.mailgun !== 'undefined') {
    mailgun = mailgunOptions.mailgun;
  } else {
    if (!mailgunOptions || !mailgunOptions.apiKey || !mailgunOptions.domain) {
      throw 'SimpleMailgunAdapter requires an API Key and domain.';
    }
    mailgun = Mailgun(mailgunOptions);
  }

  var sendMail = mail => {
    if (mailgunOptions.mime === true) {
      return sendMime(mail);
    } else {
      return sendPlain(mail);
    }
  }

  var sendPlain = mail => {
    var data = {
      from: mailgunOptions.fromAddress,
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
    }

    return new Promise((resolve, reject) => {
      mailgun.messages().send(data, (err, body) => {
        if (err != null) {
          reject(err);
        }
        resolve(body);
      });
    });
  }

  var sendMime = mail => {
    var toAddress = mail.to
    var composeData = {
      from: mailgunOptions.fromAddress,
      to: toAddress,
      subject: mail.subject,
      body: mail.text,
      html: mail.html
    }

    var mime = mailcomposer(composeData)

    return new Promise((resolve, reject) => {
      mime.build((buildErr, message) => {
        if (buildErr != null) {
          reject(err);
        } else {
          var mimeData = {
            to: toAddress,
            message: message.toString('ascii')
          }

          mailgun.messages().sendMime(mimeData, (err, body) => {
            if (typeof err !== 'undefined') {
              reject(err);
            }
            resolve(body);
          });
        }
      })
    })
  }

  var exports = {
    sendMail: sendMail,

    // The address from which to send emails
    fromAddress: mailgunOptions.fromAddress,

    // Send mode for this adapter. If true, send messages in MIME format
    mime: mailgunOptions.mime || false
  }

  if (mailgunOptions.sendVerificationEmail) {
    // TODO: Add templates for sendVerificationEmail
    exports.sendVerificationEmail = mailgunOptions.sendVerificationEmail
  }

  if (mailgunOptions.sendPasswordResetEmail) {
    if (!mailgunOptions.passwordResetTemplates || !mailgunOptions.passwordResetTemplates.text || !mailgunOptions.passwordResetTemplates.html) {
      throw new Error('SimpleMailgunAdapter requires passwordResetTemplates for text and html if you supply sendPasswordResetEmail')
    }
    exports.passwordResetTemplates = mailgunOptions.passwordResetTemplates
    exports.sendPasswordResetEmail = mailgunOptions.sendPasswordResetEmail
  }

  return Object.freeze(exports)
}

module.exports = SimpleMailgunAdapter
