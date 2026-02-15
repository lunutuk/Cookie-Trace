const httpOnlyPrefix = '#HttpOnly_';


export class NetscapeFormat {
  
  static parse(cookieString) {
    const cookies = [];
    const lines = cookieString.split('\n');
    for (let line of lines) {
      line = line.trim();
      if (!line.length) {
        continue;
      }
      const isHttpOnly = line.startsWith(httpOnlyPrefix);
      if (isHttpOnly) {
        line = line.substring(httpOnlyPrefix.length);
      }
      
      if (line[0] == '#') {
        continue;
      }

      const elements = line.split('\t');
      if (elements.length != 7) {
        throw new Error('Invalid netscape format');
      }
      cookies.push({
        domain: elements[0],
        hostOnly: elements[1].toLowerCase() === 'false',
        path: elements[2],
        secure: elements[3].toLowerCase() === 'true',
        expiration: elements[4],
        name: elements[5],
        value: elements[6],
        httpOnly: isHttpOnly,
      });
    }
    return cookies;
  }

  
  static format(cookies) {
    let netscapeCookies = '# Netscape HTTP Cookie File';
    netscapeCookies += '\n# http://curl.haxx.se/rfc/cookie_spec.html';
    netscapeCookies += '\n# Exported by Cookie Trace';
    for (const cookieId in cookies) {
      const cookie = cookies[cookieId].cookie;
      const secure = cookie.secure.toString().toUpperCase();
      let expiration = 0;

      if (cookie.session) {
        
        expiration = Math.trunc(
          new Date(Date.now() + 86400 * 1000).getTime() / 1000,
        );
      } else if (!cookie.session && !!cookie.expirationDate) {
        expiration = Math.trunc(cookie.expirationDate);
      }
      const includesSubdomain = cookie.hostOnly ? 'FALSE' : 'TRUE';

      const httpOnly = cookie.httpOnly ? httpOnlyPrefix : '';

      netscapeCookies +=
        `\n${httpOnly}${cookie.domain}	${includesSubdomain}	` +
        `${cookie.path}	${secure}	${expiration}	${cookie.name}` +
        `	${cookie.value}`;
    }
    return netscapeCookies;
  }
}
