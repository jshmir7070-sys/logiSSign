const APP_URL = process.env.EXPO_PUBLIC_APP_URL || 'https://logissign.com';

export async function sendDriverFindIdCode(params: { name: string; phone: string }) {
  const response = await fetch(`${APP_URL}/api/auth/find-id`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'send',
      accountType: 'driver',
      name: params.name,
      phone: params.phone,
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '인증번호 발송에 실패했습니다.');
  return data as { sent: boolean; expiresIn: number };
}

export async function verifyDriverFindIdCode(params: { name: string; phone: string; code: string }) {
  const response = await fetch(`${APP_URL}/api/auth/find-id`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'verify',
      accountType: 'driver',
      name: params.name,
      phone: params.phone,
      code: params.code,
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '인증번호 확인에 실패했습니다.');
  return data as { verified: boolean; email: string };
}

export async function sendDriverResetCode(params: { email: string; name: string; phone: string }) {
  const response = await fetch(`${APP_URL}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'send',
      accountType: 'driver',
      email: params.email,
      name: params.name,
      phone: params.phone,
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '인증번호 발송에 실패했습니다.');
  return data as { sent: boolean; expiresIn: number };
}

export async function verifyDriverResetCode(params: { email: string; name: string; phone: string; code: string }) {
  const response = await fetch(`${APP_URL}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'verify',
      accountType: 'driver',
      email: params.email,
      name: params.name,
      phone: params.phone,
      code: params.code,
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '휴대폰 인증에 실패했습니다.');
  return data as { verified: boolean };
}

export async function resetDriverPassword(params: {
  email: string;
  name: string;
  phone: string;
  newPassword: string;
}) {
  const response = await fetch(`${APP_URL}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'reset',
      accountType: 'driver',
      email: params.email,
      name: params.name,
      phone: params.phone,
      newPassword: params.newPassword,
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '비밀번호 변경에 실패했습니다.');
  return data as { success: boolean };
}
