/**
 * BarcodeScanner.js is licensed under the MIT license, (c) 2010.
 *
 * @author Daniel Cousineau <dcousineau@gmail.com> 
 */

/**
 * Provides a self-contained object environment from which the scanner listener 
 * can work
 * 
 * @constructor
 */
function BarcodeScanner(settings) {
    this.settings = {
        waitTolerance: 20, //Key presses must come within a tolerated delay between each press
        variationTolerance: 3, //Key presses must be evenly spaced with a variation tolerance
        scanCallback: null,
        debug: false,
        debugCallback: null
    };
    
    for( key in settings ) {
        this.settings[key] = settings[key];
    }
    
    this.reset();
}

/**
 * Logs a message to the firebug console.
 */
BarcodeScanner.prototype.log = function(message) {
    if( this.settings.debug ) {
        if( typeof this.settings.debugCallback == 'function' )
            this.settings.debugCallback(message);
        else {
            try {
                console.log(message);
            } catch( err ) {
                alert(message);
            }
        }
    }
};

/**
 * Clears state and timeouts, ususally performed when the system knows the input came
 * from a human and not a scanner.
 */
BarcodeScanner.prototype.reset = function() {
    //We're resetting, clear the timeout if it exists
    try {
        clearTimeout(this.timeout);
    } catch( err ) {
        //Ignore errors, just presume the timeout was previously cleared.
    }
    
    this.stack = [];
    this.timeout = false;
    this.lastPressed = false;
};

/**
 * Callback to pass along received barcode inputs
 */
BarcodeScanner.prototype.receive = function(code) {
    this.log('[RECEIVE CALLBACK] Accepted Code: ' + code);

    if( typeof this.settings.scanCallback == 'function' )
        this.settings.scanCallback(code);
};

/**
 * Scans the stack of recorded keypresses, looking for a group of keypresses that fits
 * within tolerance levels and report back.
 */
BarcodeScanner.prototype.validateStack = function() {
    var sumTimes = 0;
    var valid = [];
    
    for( var i = 0; i < this.stack.length; i++ ) {
        
        var press = this.stack[i];
        
        if( i == 0 ) {
            //First char, go ahead and push
            valid.push(press.key);
        }
        else {
            var previous = this.stack[i-1];
            var delay = press.time - previous.time;
            
            if( delay > this.settings.waitTolerance ) {
                //Keypress was outside the wait tolerance, which means we now ignore
                //all following keypresses and just work with what we've collected
                this.log('[STACK VALIDATION] Scan outside wait tolerance');
                
                break;
            }
            else {
                sumTimes += delay;
                valid.push(press.key);
                
                //Calculaate the current average for delays between keypresses
                var currentAverage = Math.round(sumTimes/(valid.length-1));
                
                if( Math.abs(currentAverage - delay) > this.settings.variationTolerance ) {
                    //Key press delay is not consistent with previous delays, we can
                    //assume that this is due to human error.
                    this.log('[STACK VALIDATION] Scan outside variation tolerance');
                    
                    valid = [];
                    
                    break;
                }
                
            }
        }
        
    }
    
    //A human mashing a keyboard can only get up to 3 characters within specified
    //delay and variation tolerances. Since we can assume barcodes will always be 
    //larger than 3 characters, assume that anything over 3 keypresses is the scanner
    if( valid.length > 3 )
        return valid;
    else
        return false;
};

/**
 * Returns an event listener to be used with any keypress event.
 * 
 * E.g. $(window).keypress(scanner.getKeypressListener());
 */
BarcodeScanner.prototype.getKeypressListener = function() {
    var instance  = this;

    return function() {
        return BarcodeScanner.listener.apply(instance, arguments);
    };
};

/**
 * Cross-browser abstraction to grab the character from the event.
 */
BarcodeScanner.getChar = function(event) {
    var code = null;
    
    if( event.keyCode )
        code = event.keyCode;
    else if( event.which )
        code = event.which;
    
    return String.fromCharCode(code);
};

/**
 * Primary event listener
 */
BarcodeScanner.listener = function(event) {
    var keyPressed = BarcodeScanner.getChar(event);
    var timePressed = new Date().getTime();
    
    if( !this.timeout )
    {
        var instance = this;

        //Create a timeout so that the scanner has only a small window to input all
        //characters. The window is small enough that a human cannot input characters
        //in line with tolerances fast enough, but within the amount of time it takes
        //the scanner to send the data from a large-ish barcode.
        this.timeout = setTimeout(function() { 
            (function() {
                    
                var valid = this.validateStack();
                
                this.reset();
                
                if( valid ) {
                    return this.receive( valid.join('') );
                }
                else {
                    this.log('[LISTENER TIMEOUT] Outside of timeout tolerance');
                    
                    return;
                }
                
            }).apply(instance, arguments);
        }, 250);
    }
    
    //Pre-emptive invalidation. If the keypress notices a key outside of the wait
    //tolerance, go ahead and clear things up instead of waiting for the listener
    if( this.lastPressed && this.lastPressed - timePressed  > this.settings.waitTolerance ) {
        
        //If this is the second character and we're already outsidde the wait tolerance, just reset.
        if( this.stack.length <= 1 ) {
            this.reset();
        }
        else {
            
            //A stream of characters has already been input. Go ahead and check
            //the stack. If we find a valid scan inside, go ahead and clear the
            //timeout and signal receipt as normal
            var valid = this.validateStack();
            
            this.reset();
            
            if( valid ) {
                return this.receive( valid.join('') );
            }
            else {
                return false;
            }
        }
        
    }
    else {
        
        //Everything is within acceptable tolerances so far, just record the keypress.
        this.stack.push({
            key: keyPressed,
            time: timePressed
        });
        
    }
    
    this.lastPressed = timePressed;
};
