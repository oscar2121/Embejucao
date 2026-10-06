const fs = require('fs');

try {
  let text = fs.readFileSync('App.js', 'utf8');

  // Regex to match UTF-8 bytes that were interpreted as Latin-1
  // Latin-1 characters from 0xC2 to 0xF4 followed by one or more 0x80 to 0xBF
  const mojibakeRegex = /[\xC2-\xF4][\x80-\xBF]+/g;

  let count = 0;
  let newText = text.replace(mojibakeRegex, (match) => {
    count++;
    return Buffer.from(match, 'latin1').toString('utf8');
  });

  // Additional pass for 3-byte or 4-byte sequences that might have some characters outside the strictly \x80-\xBF range in some weird encodings?
  // Actually, Latin-1 matches exactly. But let's check if Windows-1252 mapped some bytes like 0x80 to \u20AC (Euro sign).
  // If the file was read as Windows-1252, then byte 0x80 became \u20AC, not \x80.
  // Wait, Node.js 'utf8' reading might have preserved the characters as they were in the file.
  // Let's do a generic replace using a known map for Windows-1252 -> Latin-1 bytes if needed.
  // But let's see if the regex matches first.
  
  const matches = text.match(mojibakeRegex);
  console.log("Found " + (matches ? matches.length : 0) + " mojibake sequences using latin1 regex.");
  
  if (count > 0) {
    fs.writeFileSync('App.js', newText, 'utf8');
    console.log("Replaced successfully.");
  }
} catch(e) {
  console.error(e);
}
