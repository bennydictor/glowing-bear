(function() {
'use strict';

var weechat = angular.module('weechat');

var flashStyleId = 0;

var smiliesIndex = {};

var isSmilieRegex = [];
var specialSmilies = [];
for (var i in smiliesIndex) {
    i = i.replace(/[()*\[\]?]/g, m => "\\" + m);
    if (i.match(/^:.*:$/)) {
        isSmilieRegex.push(i);
    } else {
        specialSmilies.push(i);
    }
}
isSmilieRegex = new RegExp("^(" + isSmilieRegex.join("|") + "|" + specialSmilies.join("|") + ")");

weechat.filter('bennyLinky', ["$sanitize", function($sanitize) {
    function escapeHtml(text) {
        return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }
    function escapeQuote(text) {
        return text.replace(/"/g, "&quot;");
    }
    function matchBBS(text, openBracket, closeBracket) {
        if (text[0] != openBracket) {
            return null;
        }
        var balance = 1;
        var i;
        for (i = 1; i < text.length; ++i) {
            if (text[i] == openBracket) {
                balance += 1;
            } else if (text[i] == closeBracket) {
                balance -= 1;
            }
            if (balance == 0) {
                break;
            }
        }
        if (balance != 0) {
            return null;
        }
        return text.substring(0, i+1);
    }
    function matchMDUrl(text) {
        var match1 = matchBBS(text, "[", "]");
        if (match1 == null) {
            return null;
        }
        text = text.substring(match1.length);
        var match2 = matchBBS(text, "(", ")");
        if (match2 == null) {
            return null;
        }
        return [match1 + match2, match1.substring(1, match1.length - 1), match2.substring(1, match2.length - 1)];
    }
    function formatText(text, enableNewlines, enableMdLinks, enableColours) {
        if (!text) return text;
        var out = "";
        while (text != "") {
            var match;
            if ((match = text.match(/^(http|https):\/\/\S+/)) != null) {
                out += "<a href=\"" + escapeQuote(match[0]) + "\" target=\"_blank\">" + escapeHtml(match[0]) + "</a>";
                text = text.substring(match[0].length);
            } else if ((match = matchMDUrl(text)) != null) {
                if (enableMdLinks) {
                    out += "<a href=\"" + escapeQuote(match[2]) + "\" target=\"_blank\">" + escapeHtml(match[1]) + "</a>";
                } else {
                    out += "[" + escapeHtml(match[1]) + "](<a href=\"" + escapeQuote(match[2]) + "\" target=\"_blank\">" + escapeHtml(match[2]) + "</a>)";
                }
                text = text.substring(match[0].length);
            } else if ((match = text.match(/^\\(.)/)) != null) {
                if (match[1] == 'n') {
                    if (enableNewlines) {
                        out += "<br/>";
                    } else {
                        out += escapeHtml(match[0]);
                    }
                } else {
                    out += escapeHtml(match[1]);
                }
                text = text.substring(match[0].length);
            } else if ((match = text.match(/^<colou?r\s+([#0-9a-zA-Z]*)\s*(?:(\sflash)\s*)?>(.*?)<\/colou?r>/)) != null) {
                var tmp = document.createElement("span");
                tmp.setAttribute("style", "color: " + match[1] + "; display: none");
                document.body.appendChild(tmp);
                var color = getComputedStyle(tmp)["color"];
                document.body.removeChild(tmp);

                color = color.match(/rgb\((\d+), (\d+), (\d+)\)/);
                color = [parseInt(color[1]), parseInt(color[2]), parseInt(color[3])];
                if (enableColours) {
                    if (match[2] != null) {
                        var amount = Math.min(255 / Math.max(Math.max(color[0], color[1]), color[2]), 2);
                        var color2 = [color[0] * amount, color[1] * amount, color[2] * amount];
                        var styleElt = document.createElement("style");
                        styleElt.textContent = "@keyframes flashStyle" + flashStyleId + " { from { color: rgb(" + color[0] + ", " + color[1] + ", " + color[2] + "); }" +
                            "to { color: rgb(" + color2[0] + ", " + color2[1] + ", " + color2[2] + "); }}";
                        document.body.appendChild(styleElt);
                        out += "<span style=\"animation: flashStyle" + flashStyleId + " .01s ease-in-out infinite alternate\">" + formatText(match[3], enableNewlines, enableMdLinks, enableColours) + "</span>";
                        flashStyleId += 1;
                    } else {
                        out += "<span style=\"color: rgb(" + color[0] + ", " + color[1] + ", " + color[2] + ")\">" + formatText(match[3], enableNewlines, enableMdLinks, enableColours) + "</span>";
                    }
                } else {
                    var flash = match[2];
                    if (flash == null) {
                        flash = "";
                    }
                    out += "&lt;colour rgb(" + color[0] + ", " + color[1] + ", " + color[2] + ")" + flash + "&gt;" + formatText(match[3], enableNewlines, enableMdLinks, enableColours) + "&lt;/colour&gt;";
                }
                text = text.substring(match[0].length);
            } else if ((match = text.match(isSmilieRegex)) != null) {
                var smilie = smiliesIndex[match[0]];
                var addTitle = smilie.title;
                if (addTitle != "") {
                    addTitle = " " + addTitle;
                }
                out += "<img src=\"" + smilie.url + "\" title=\"" + match[0] + addTitle + "\"/>";
                text = text.substring(match[0].length);
            } else {
                out += escapeHtml(text[0]);
                text = text.substring(1);
            }
        }
        return out;
    }
    return formatText;
}]);

weechat.filter('toArray', function () {
    return function (obj, storeIdx) {
        if (!(obj instanceof Object)) {
            return obj;
        }

        if (storeIdx) {
            return Object.keys(obj).map(function (key, idx) {
                return Object.defineProperties(obj[key], {
                    '$key' : { value: key },
                    '$idx' : { value: idx, configurable: true }
                });
            });
        }

        return Object.keys(obj).map(function (key) {
            return Object.defineProperty(obj[key], '$key', { value: key });
        });
    };
});

weechat.filter('irclinky', function() {
    return function(text) {
        if (!text) {
            return text;
        }

        // This regex in no way matches all IRC channel names (they could also begin with &, + or an
        // exclamation mark followed by 5 alphanumeric characters, and are bounded in length by 50).
        // However, it matches all *common* IRC channels while trying to minimise false positives.
        // "#1" is much more likely to be "number 1" than "IRC channel #1".
        // Thus, we only match channels beginning with a # and having at least one letter in them.
        var channelRegex = /(^|[\s,.:;?!"'()+@-\~%])(#+[^\x00\x07\r\n\s,:]*[a-z][^\x00\x07\r\n\s,:]*)/gmi;
        // Call the method we bound to window.openBuffer when we instantiated
        // the Weechat controller.
        var substitute = '$1<a href="#" onclick="openBuffer(\'$2\');">$2</a>';
        return text.replace(channelRegex, substitute);
    };
});

weechat.filter('inlinecolour', function() {
    return function(text) {
        if (!text) {
            return text;
        }

        // only match 6-digit colour codes, 3-digit ones have too many false positives (issue numbers, etc)
        var hexColourRegex = /(^|[^&])(\#[0-9a-f]{6};?)(?!\w)/gmi;
        var rgbColourRegex = /(.?)(rgba?\((?:\s*\d+\s*,){2}\s*\d+\s*(?:,\s*[\d.]+\s*)?\);?)/gmi;
        var substitute = '$1$2 <div class="colourbox" style="background-color:$2"></div>';
        text = text.replace(hexColourRegex, substitute);
        text = text.replace(rgbColourRegex, substitute);
        return text;
    };
});

// Calls the 'linky' filter unless the disable flag is set. Useful for things like join/quit messages,
// so you don't accidentally click a mailto: on someone's hostmask.
weechat.filter('conditionalLinkify', ['$filter', function($filter) {
    return function(text, disable) {
        if (!text || disable) {
            return text;
        }
        return $filter('linky')(text, '_blank', {rel:'noopener noreferrer'});
    };
}]);

// apply a filter to an HTML string's text nodes, and do so with not exceedingly terrible performance
weechat.filter('DOMfilter', ['$filter', '$sce', function($filter, $sce) {
    // To prevent nested anchors, we need to know if a filter is going to create them.
    // Here's a list of names. See #681 for more information.
    var filtersThatCreateAnchors = ['irclinky'];

    return function(text, filter) {
        if (!text || !filter) {
            return text;
        }
        var createsAnchor = filtersThatCreateAnchors.indexOf(filter) > -1;

        var escape_html = function(text) {
            // First, escape entities to prevent escaping issues because it's a bad idea
            // to parse/modify HTML with regexes, which we do a couple of lines down...
            var entities = {"<": "&lt;", ">": "&gt;", '"': '&quot;', "'": '&#39;', "&": "&amp;", "/": '&#x2F;'};
            return text.replace(/[<>"'&\/]/g, function (char) {
                return entities[char];
            });
        };

        // hacky way to pass extra arguments without using .apply, which
        // would require assembling an argument array. PERFORMANCE!!!
        var extraArgument = (arguments.length > 2) ? arguments[2] : null;
        var thirdArgument = (arguments.length > 3) ? arguments[3] : null;

        var filterFunction = $filter(filter);
        var el = document.createElement('div');
        el.innerHTML = text;

        // Recursive DOM-walking function applying the filter to the text nodes
        var process = function(node) {
            if (node.nodeType === 3) { // text node
                // apply the filter to *escaped* HTML, and only commit changes if
                // it changed the escaped value. This is because setting the result
                // as innerHTML causes it to be unescaped.
                var input = escape_html(node.nodeValue);
                var value = filterFunction(input, extraArgument, thirdArgument);

                if (value !== input) {
                    // we changed something. create a new node to replace the current one
                    // we could also only add its children but that would probably incur
                    // more overhead than it would gain us
                    var newNode = document.createElement('span');
                    newNode.innerHTML = value;

                    var parent = node.parentNode;
                    var sibling = node.nextSibling;
                    parent.removeChild(node);
                    if (sibling) {
                        parent.insertBefore(newNode, sibling);
                    } else {
                        parent.appendChild(newNode);
                    }
                    return newNode;
                }
            }
            // recurse
            if (node === undefined || node === null) return;
            node = node.firstChild;
            while (node) {
                var nextNode = null;
                // do not recurse inside links if the filter would create a nested link
                if (!(createsAnchor && node.tagName === 'A')) {
                    nextNode = process(node);
                }
                node = (nextNode ? nextNode : node).nextSibling;
            }
        };

        process(el);

        return $sce.trustAsHtml(el.innerHTML);
    };
}]);

// This is used by the cordova app to change link targets to "window.open(<url>, '_system')"
// so that they're opened in a browser window and don't navigate away from Glowing Bear
weechat.filter('linksForCordova', ['$sce', function($sce) {
    return function(text) {
        // XXX TODO this needs to be improved
        text = text.replace(/<a (rel="[a-z ]+"\s+)?(?:target="_[a-z]+"\s+)?href="([^"]+)"/gi,
                            "<a $1 onClick=\"window.open('$2', '_system')\"");
        return $sce.trustAsHtml(text);
    };
}]);

weechat.filter('getBufferQuickKeys', function () {
    return function (obj, $scope) {
        if (!$scope) { return obj; }
        if (($scope.search !== undefined && $scope.search.length) || $scope.onlyUnread) {
            obj.forEach(function(buf, idx) {
                buf.$quickKey = idx < 10 ? (idx + 1) % 10 : '';
            });
        } else {
            _.map(obj, function(buffer, idx) {
                return [buffer.number, buffer.$idx, idx];
            }).sort(function(left, right) {
                // By default, Array.prototype.sort() sorts alphabetically.
                // Pass an ordering function to sort by first element.
                return left[0] - right[0] || left[1] - right[1];
            }).forEach(function(info, keyIdx) {
                obj[ info[2] ].$quickKey = keyIdx < 10 ? (keyIdx + 1) % 10 : '';
                // Don't update jump key upon filtering
                if (obj[ info[2] ].$jumpKey === undefined) {
                    // Only assign jump keys up to 99
                    obj[ info[2] ].$jumpKey = (keyIdx < 99) ? keyIdx + 1 : '';
                }
            });
        }
        return obj;
    };
});

// Emojifis the string using https://github.com/Ranks/emojione
weechat.filter('emojify', function() {
    return function(text, enable_JS_Emoji) {
        if (enable_JS_Emoji === true && window.emojione !== undefined) {
            // Emoji live in the D800-DFFF surrogate plane; only bother passing
            // this range to CPU-expensive unicodeToImage();
            var emojiRegex = /[\uD800-\uDBFF][\uDC00-\uDFFF]/g;
            if (emojiRegex.test(text)) {
                return emojione.unicodeToImage(text);
            } else {
                return(text);
            }
        } else {
            return(text);
        }
    };
});

weechat.filter('latexmath', function() {
    return function(text, selector, enabled) {
        if (!enabled || typeof(katex) === "undefined") {
            return text;
        }
        if (text.indexOf("$$") != -1 || text.indexOf("\\[") != -1 || text.indexOf("\\(") != -1) {
            // contains math -> delayed rendering
            setTimeout(function() {
                var math = document.querySelector(selector);
                renderMathInElement(math, {
                    delimiters: [
                        {left: "$$", right: "$$", display: false},
                        {left: "\\[", right: "\\]", display: true},
                        {left: "\\(", right: "\\)", display: false}
                    ]
                });
            });
        }

        return text;
    };
});

weechat.filter('prefixlimit', function() {
    return function(input, chars) {
        if (isNaN(chars)) return input;
        if (chars <= 0) return '';
        if (input && input.length > chars) {
            input = input.substring(0, chars);
            return input + '+';
        }
        return input;
    };
});

weechat.filter('codify', function() {
    return function(text) {
        var re = /`(.+?)`/g;
        return text.replace(re, function(match, code) {
            var rr = '<span class="hidden-bracket">`</span><code>' + code + '</code><span class="hidden-bracket">`</span>';
            return rr;
        });
    };
});

})();
