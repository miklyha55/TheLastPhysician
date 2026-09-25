(function() {
    kIllegals = [
        0 // null
        , 10 // newline
        , 13 // carriage return
        , 34 // double quote
        , 38 // ampersand
        , 92 // backslash
    ]
    , kShortened = 0b111 // Uses the illegal index to signify the last two-byte char encodes <= 7 bits.
    ;

    function bufferToBase64(buffer) {
            const bytes = new Uint8Array(buffer);
            const CHUNK_SIZE = 0x8000;
            let binary = '';
            for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
                const chunk = bytes.slice(i, Math.min(i + CHUNK_SIZE, bytes.length));
                binary += String.fromCharCode.apply(null, chunk);
            }
            return btoa(binary);
    }

    function decode(base122Data) {
        let strData = typeof(base122Data) == 'string' ? base122Data : utf8DataToString(base122Data)
        , decoded = []
        , curByte = 0
        , bitOfByte = 0
        ;

        function push7(byte) {
            byte <<= 1;
            // Align this byte to offset for current byte.
            curByte |= (byte >>> bitOfByte);
            bitOfByte += 7;
            if (bitOfByte >= 8) {
                decoded.push(curByte);
                bitOfByte -= 8;
                // Now, take the remainder, left shift by what has been taken.
                curByte = (byte << (7 - bitOfByte)) & 255;
            }
        }

        for (let i = 0; i < strData.length; i++) {
            let c = strData.charCodeAt(i);
            // Check if this is a two-byte character.
            if (c > 127) {
                // Note, the charCodeAt will give the codePoint, thus
                // 0b110xxxxx 0b10yyyyyy will give => xxxxxyyyyyy
                let illegalIndex = (c >>> 8) & 7; // 7 = 0b111.
                // We have to first check if this is a shortened two-byte character, i.e. if it only
                // encodes <= 7 bits.
                if (illegalIndex != kShortened) push7(kIllegals[illegalIndex]);
                // Always push the rest.
                push7(c & 127);
            } else {
                // One byte characters can be pushed directly.
                push7(c);
            }
        }
        return decoded;
    }

    // replace b122 with b64
    const base122Data = window.__adapter_zip__;
    const decoded = decode(base122Data);
    window.__adapter_zip__ = bufferToBase64(decoded);
}());
