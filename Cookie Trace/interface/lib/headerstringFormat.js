
export class HeaderstringFormat {
  
  static parse(cookieString) {
    const cookies = [];
    const rawCookies = cookieString.split(';');
    for (let rawCookie of rawCookies) {
      rawCookie = rawCookie.trim();
      if (!rawCookie.length) {
        continue;
      }
      const cookieParts = rawCookie.split('=');
      if (cookieParts.length != 2) {
        
        continue;
      }
      cookies.push({
        name: cookieParts[0],
        value: cookieParts[1],
      });
    }

    if (cookies.length === 0) {
      throw new Error('No cookies found.');
    }

    return cookies;
  }

  
  static format(cookies) {
    const exportedCookies = [];
    for (const cookieId in cookies) {
      const exportedCookie = cookies[cookieId].cookie;
      const name = exportedCookie.name;
      const value = exportedCookie.value;
      exportedCookies.push(`${name}=${value}`);
    }
    return exportedCookies.join(';');
  }
}
