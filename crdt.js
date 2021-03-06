var CRDT = () => {
    let C = {};
    C.crdt = [[]];
    C.BASE = 256;


C.add = (n1, n2) => {
	let carry = 0;
    let diff = new Array();
    for (let i = Math.max(n1.length, n2.length) - 1; i >= 0; i--) {
        let sum = (n1[i] || 0) + (n2[i] || 0) + carry;
        carry = Math.floor(sum / C.BASE);
        diff[i] = (sum % C.BASE);
    }
    if (carry !== 0) {
    	console.log('Something wrong');
    }
    return diff;
};

C.subtract = (n1,n2) => {
	let carry = 0;
    let diff = new Array();
    for (let i = Math.max(n1.length, n2.length) - 1; i >= 0; i--) {
        let d1 = (n1[i] || 0) - carry;
        let d2 = (n2[i] || 0);
        if (d1 < d2) {
            carry = 1;
            diff[i] = d1 + C.BASE - d2;
        } else {
            carry = 0;
            diff[i] = d1 - d2;
        }
    }
    return diff;
};

C.fromIdentifiers = (identifiers) => {
	return identifiers.map(id => id.digit);
};

C.toIdentifiers = (num, before, after, site) => {
	return num.map((digit, index) => {
		if (index === num.length - 1) {
			return C.identifier(digit, site);
		}
		else if (index < before.length && digit === before[index].digit) {
			return C.identifier(digit, before[index].site);
		}
		else if (index < after.length && digit === after[index].digit) {
			return C.identifier(digit, after[index].site);
		}
		else {
			return C.identifier(digit, site);
		}
	});
};

C.increment = (num, delta) => {
	let firstNonzero = delta.findIndex(x => x !== 0);
	let inc = delta.slice(0, firstNonzero).concat([0, 1]);
	let v1 = C.add(num, inc);
	let v2 = v1[v1.length - 1] === 0 ? C.add(v1, inc) : v1;
	return v2;
};

C.identifier = (digit, site) => {
	return {
		digit : digit || 0,
		site : site || 0
	};
};

C.char = (identifiers, lamport, value) => {
	return {
		position : identifiers || [],
		lamport : lamport || 0,
		value : value || ''
	};
};

C.startOfFile = C.char([{digit:1,site:-1}], 0, '^');
C.endOfFile = C.char([{digit:255,site:1000}], 0, '$');

C.compareIdentifier = (i1, i2) => {
	if (i1.digit < i2.digit) {
		return -1;
	} else if (i1.digit > i2.digit) {
		return 1;
	} else {
		if (i1.site < i2.site) {
			return -1;
		} else if (i1.site > i2.site) {
			return 1;
		} else {
			return 0;
		}
	}
};

C.equalChar = (c1, c2) => {
    if (c1.position.length !== c2.position.length) return false;
    if (c1.lamport !== c2.lamport) return false;
    if (c1.value !== c2.value) return false;
    for (let i = 0; i < c1.position.length; i++) {
        if (C.compareIdentifier(c1.position[i], c2.position[i]) !== 0) return false;
    }
    return true;
};

C.comparePosition = (p1, p2) => {
	for (let i = 0; i < Math.min(p1.length, p2.length); i++) {
		let comp = C.compareIdentifier(p1[i], p2[i]);
		if (comp !== 0)
			return comp;
	}
	if (p1.length < p2.length) {
		return -1;
	} else if (p1.length > p2.length) {
		return 1;
	} else {
		return 0;
	}
};

C.compareChar = (c1, c2) => {
	return C.comparePosition(c1.position, c2.position);
};

C.generatePositionBetween = (p1, p2, site) => {
	let head1 = p1[0] || C.identifier(0, site);
	let head2 = p2[0] || C.identifier(C.BASE, site);
	if (head1.digit !== head2.digit) {
		let n1 = C.fromIdentifiers(p1);
		let n2 = C.fromIdentifiers(p2);
		let delta = C.subtract(n2, n1);
		let next = C.increment(n1, delta);
		return C.toIdentifiers(next, p1, p2, site);
	} else {
		if (head1.site < head2.site) {
            p1.splice(0,1);
			return [head1].concat(C.generatePositionBetween(p1, [], site));
		}
		else if (head1.site === head2.site) {
            p1.splice(0,1);
            p2.splice(0,1);
			return [head1].concat(C.generatePositionBetween(p1, p2, site));
		} else {
			console.log('Invalid site ordering');
		}
	}
};

C.binarySearch = (U, V, comparator, notFoundBehavior) => {

    let _binarySearch = (start, end) => {
        if (start >= end) {
            switch (notFoundBehavior) {
                case "at":
                    return start;
                case "before":
                    return start - 1;
                 default:
                 	return start;
            }
        } else {
            const mid = Math.floor((start + end) / 2);
            const comp = comparator(V, U[mid]);
            if (comp < 0) {
                return _binarySearch(start, mid);
            } else if (comp > 0) {
                return _binarySearch(mid + 1, end);
            } else {
                return mid;
            }
        }
    }
    return _binarySearch(0, U.length);
};


//deep copy
C.getChar = (lineIndex, charIndex) => {
    const l = C.crdt[lineIndex];
    if (!l) return C.endOfFile;
	const c = C.crdt[lineIndex][charIndex];
    if (!c) return C.endOfFile;
	return C.char(c.position.map(i => {return {digit : i.digit, site : i.site}}), c.lamport, c.value);
};

C.getCharValue = (lineIndex, charIndex) => {
    return c.crdt[lineIndex][charIndex].value;
};

//deep copy
C.getLine = (lineIndex) => {
    if (!C.crdt[lineIndex]) return [];
	return C.crdt[lineIndex].map((char, charIndex) => C.getChar(lineIndex, charIndex));
};

C.compareCharWithLine = (char, line) => {
	if (line.length === 0)
		return -1;
	else {
		return C.compareChar(char, line[0]);
	}
};

C.findPosition = (char) => {
	const lineIndex = Math.max(0, C.binarySearch(C.crdt, char, C.compareCharWithLine, "before"));
	const line = C.getLine(lineIndex);
	const charIndex = C.binarySearch(line, char, C.compareChar, "at");
	if (charIndex < line.length) {
        let found = C.compareChar(C.crdt[lineIndex][charIndex], char) === 0;
        return [lineIndex, charIndex, found ? "found" : "not_found"];
    } else {
        const isAfterNewline = (charIndex === line.length) && (lineIndex !== C.crdt.length - 1);
        // All lines except the last one need to end in a newline, so put C character
        // on the next line if it would go at the end of the line.
        if (isAfterNewline) {
            return [lineIndex + 1, 0, "not_found"];
        } else {
            return [lineIndex, charIndex, "not_found"];
        }
    }
};

C.getPreChar = (lineIndex, charIndex) => {
	if (charIndex === 0) {
        if (lineIndex === 0) {
            return C.startOfFile;
        } else {
            return C.getChar(lineIndex - 1, C.crdt[lineIndex - 1].length - 1);
        }
    } else {
        return C.getChar(lineIndex, charIndex - 1);
    }
};

C.updateCrdtRemove = (change) => {
    let lines = [];
    for (let lineIndex = change.from.line; lineIndex <= change.to.line; lineIndex++)
        lines.push(C.getLine(lineIndex));
    const linesAndUpdates = lines.map((line, index) => {
        let startIndex;
        let endIndex;
        if (index === 0) {
            startIndex = change.from.ch;
        } else {
            startIndex = 0;
        }
        if (index === lines.length - 1) {
            endIndex = change.to.ch;
        } else {
            endIndex = line.length;
        }
        let toRemove = line.slice(startIndex, endIndex);
        if (toRemove.length !== endIndex - startIndex) {
            alert("size does not match");
        }
        line.splice(startIndex, endIndex - startIndex);
        return [line, toRemove];
    });
    const updatedLines = linesAndUpdates.map(tuple => tuple[0]);
    const _toRemove = linesAndUpdates.map(tuple => tuple[1]);
    let toRemove = [];
    _toRemove.forEach(array => {toRemove = toRemove.concat(array)});

    // Only the first and last line should be non-empty, so we just keep those.
    /*
    if (lines.length === 1) {
		C.crdt[change.from.line] = updatedLines[0];
    } else {
        const remainingLine = updatedLines[0].concat(updatedLines[updatedLines.length-1]);
        C.crdt.splice(change.from.line, lines.length, remainingLine);
    }
    */
    return toRemove;
}

C.updateCrdtInsert = (lamport, site, change) => {
	const lineIndex = change.from.line;
    const ch = change.from.ch;
    const line = C.getLine(lineIndex);
    let before = line.slice(0, ch);
    const after = line.slice(ch, line.length);

    let previousChar = C.getPreChar(lineIndex, ch);
    const nextChar = C.getChar(lineIndex, ch);
    const lines = [];
    const addedChars = [];
    let addedChar;
    for (let textIndex in change.text) {
        addedChar = change.text[textIndex];
        const newPosition = C.generatePositionBetween(
            previousChar.position, nextChar.position, site);
        const newChar = C.char(newPosition, lamport, addedChar);
        before.push(newChar);
        if (addedChar === "\n") {
            lines.push(before);
            before = [];
        }

        addedChars.push(newChar);
        previousChar = newChar;
    }

    const currentLine = before.concat(after);
    lines.push(currentLine);

    //C.crdt.splice(lineIndex, 1, ...lines);
    return addedChars;
}

C.remoteInsert = (char) => {
    const [lineIndex, ch, found] = C.findPosition(char);
        const line = C.getLine(lineIndex);
        if (found === "not_found") {
            const change = {
                from : {line : lineIndex, ch}, 
                to : {line: lineIndex, ch}, 
                text : char.value
            };
            if (char.value === "\n") {
                const before = line.slice(0, ch);
    			const after = line.slice(ch, line.length);
                before.push(char);
                C.crdt.splice(lineIndex, 1, ...[before, after]);
                return change;
            } else {
                C.crdt[lineIndex].splice(ch, 0, char);
                return change;
            }
        } else {
            // Probably means we got a duplicate for some reason
            return null;
        }
};

C.remoteDelete = (char) => {
        const [lineIndex, ch, found] = C.findPosition(char);
        let line = C.getLine(lineIndex);
        if (found === "found" && C.equalChar(line[ch], char)) {
            line.splice(ch, 1);
            const nextLine = C.getLine(lineIndex + 1);

            if (line.findIndex(char => char.value === "\n") < 0 && C.crdt[lineIndex + 1]) {
                // Newline character was removed, need to join with the next line
                const change = {
                    from : {line: lineIndex, ch}, 
                    to : {line: lineIndex + 1, ch: 0}, 
                    text : ""
                };
                C.crdt.splice(lineIndex, 2, line.concat(nextLine));
                return change;
            } else {
                const change = {
                    from : {line: lineIndex, ch},
                    to : {line: lineIndex, ch: ch + 1}, 
                    text : ""
                };
                C.crdt[lineIndex] = line;
                return change;
            }
        } else {
            return null;
        }
};

C.convertLocalToRemote = (lamport, site, change) => {
    if (change.from.line > change.to.line ||
        (change.from.line === change.to.line && change.from.ch > change.to.ch)) {
        alert("got inverted from/to");
    }

    switch (change.origin) {
        case "+delete":
            const deleteChange = {
                from : change.from,
                to : change.to,
                text : ""
            };
            return C.updateCrdtRemove(deleteChange).map(char => ["remove",char]);
        case "+input":
        case "paste":
            // Pure insertions have change.removed = [""]
            let removeChanges = [];
            if (change.removed && !(change.removed.length === 1 && change.removed[0] === "")) {
                const deletion = {
                    from : change.from,
                    to : change.to,
                    text : ""
                };
                removeChanges = C.updateCrdtRemove(deletion).map(char => ["remove",char]);
            }
            // All strings expect the last one represent the insertion of a new line
            const insert = {
                from : change.from,
                to :change.to,
                text : change.text.join("\n")
            };
            const insertChanges = C.updateCrdtInsert(lamport, site, insert).map(char => ["add",char]);
            return removeChanges.concat(insertChanges);
        default:
            alert("Unknown change origin " + change.origin);
    }
};

C.updateAndConvertRemoteToLocal = (change) => {
    const char = change[1];
    switch (change[0]) {
        case "add":
            return C.remoteInsert(char);
        case "remove":
            return C.remoteDelete(char);
        default: alert("unknown remote change");
    }
};

C.isNumber = (ch) => {
    return (ch >= '0' && ch <= '9');
};

C.findAllAvailSpace = (site) => {
    let user = 0;
    let availSpace = {};
    let availSpaces = [];
    let i = 0, j = 0, k = 0;
    while (i < C.crdt.length) {
        j = 0;
        while (j < C.crdt[i].length) {
            if (C.crdt[i][j].value === '\\' && 
                C.crdt[i][j+1] && C.crdt[i][j+1].value === 'g') {

                k = j;
                j = j + 2;
                let num_site = 0;
                if (C.crdt[i][j]) {
                    while (C.crdt[i][j] && C.isNumber(C.crdt[i][j].value)) {
                        num_site = num_site * 10 + C.crdt[i][j].value - '0';
                        j = j + 1;
                    }
                    if (!C.crdt[i][j]) break;
                    if (C.crdt[i][j].value !== '\\') break;

                    if (num_site > 0) {     //private space
                        if (user === 0) {
                            user = num_site;
                            availSpace.s = C.getChar(i, j);
                        }
                        else 
                            if (user === num_site) {
                                if (user === site) {
                                    availSpace.e = C.getChar(i, k);
                                    availSpaces.push(availSpace);
                                }
                                availSpace = {};
                                user = 0;
                        }
                    }
                    else if (num_site === 0 && k + 2 === j) {   //common space
                        if (user === 0) {
                            user = -1;
                            availSpace.s = C.getChar(i, j);
                        }
                        else if (user === -1) {
                            availSpace.e = C.getChar(i, k);
                            availSpaces.push(availSpace);
                            availSpace = {};
                            user = 0;
                        }
                    }
                }
            }
            else {
                j = j + 1;
            }
        }
        i = i + 1;
    }
    return availSpaces;
};

C.isAvail = (availSpaces, char) => {
    for (let index in availSpaces) {
        if (C.compareChar(availSpaces[index].s, char) === -1 &&
              C.compareChar(char, availSpaces[index].e) === -1)
            return 1;
    }
    return 0;
};


return C;
};

if ('undefined' != typeof global) {
    module.exports = CRDT;
}

