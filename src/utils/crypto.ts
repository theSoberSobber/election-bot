import crypto from 'crypto';

export function verifySignature(
  message: string,
  signature: string,
  publicKeyPem: string
): boolean {
  try {
    return crypto.verify(
      'sha256',
      Buffer.from(message, 'utf8'),
      {
        key: publicKeyPem,
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
      },
      Buffer.from(signature, 'base64')
    );
  } catch (error) {
    console.error('Signature verification failed:', error);
    return false;
  }
}

export function parsePublicKey(publicKeyPem: string): boolean {
  try {
    const keyObject = crypto.createPublicKey(publicKeyPem);
    return keyObject.asymmetricKeyType === 'rsa';
  } catch (error) {
    console.error('Failed to parse public key:', error);
    return false;
  }
}

export function generateElectionId(): string {
  return crypto.randomUUID();
}
