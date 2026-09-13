const crypto = require('node:crypto');

function key() {
  const value = process.env.PATIENT_DATA_ENCRYPTION_KEY || '';
  if (!/^[a-f0-9]{64}$/i.test(value)) throw new Error('Patient encryption key is not configured.');
  return Buffer.from(value, 'hex');
}

function encryptIdentifiers(body, owner, caseId) {
  const name = String(body.patient_name || '').trim();
  const mrn = String(body.patient_mrn || '').trim();
  if (name.length > 120 || mrn.length > 80) throw new Error('Name or MRN is too long.');
  if (!name && !mrn) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  cipher.setAAD(Buffer.from(`${owner}:${caseId}`));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify({ name, mrn }), 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), ciphertext.toString('base64')].join('.');
}

function decryptIdentifiers(value, owner, caseId) {
  if (!value) return { name: '', mrn: '' };
  const [version, iv, tag, ciphertext] = value.split('.');
  if (version !== 'v1' || !iv || !tag || !ciphertext) throw new Error('Invalid encrypted identifiers.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
  decipher.setAAD(Buffer.from(`${owner}:${caseId}`));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64')), decipher.final()]).toString('utf8'));
}

module.exports = { encryptIdentifiers, decryptIdentifiers };
