const hbs = require('hbs');

// Register Handlebars helpers
module.exports.registerHelpers = function() {
    // Helper to repeat content a specific number of times
    hbs.registerHelper('times', function(n, block) {
        let accum = '';
        for (let i = 0; i < n; ++i) {
            accum += block.fn(i);
        }
        return accum;
    });

    // Helper to repeat content for the remaining count (total - n)
    hbs.registerHelper('times_remaining', function(n, total, block) {
        let accum = '';
        for (let i = 0; i < (total - n); ++i) {
            accum += block.fn(i);
        }
        return accum;
    });

    // Helper for "if less than" conditional
    hbs.registerHelper('if_lt', function(a, b, options) {
        if (a < b) {
            return options.fn(this);
        }
        return options.inverse(this);
    });

    // Helper for "if greater than" conditional
    hbs.registerHelper('if_gt', function(a, b, options) {
        if (a > b) {
            return options.fn(this);
        }
        return options.inverse(this);
    });

    // Helper for "if equal" conditional
    hbs.registerHelper('if_eq', function(a, b, options) {
        if (a == b) { // Use == instead of === for type coercion, which is often needed in templates
            return options.fn(this);
        }
        return options.inverse(this);
    });

    // Helper for subtraction
    hbs.registerHelper('subtract', function(a, b) {
        return a - b;
    });

    // Helper for addition
    hbs.registerHelper('add', function() {
        let sum = 0;
        for (let i = 0; i < arguments.length - 1; i++) {
            sum += parseFloat(arguments[i]) || 0;
        }
        return sum;
    });

    // Helper for formatting dates
    hbs.registerHelper('formatDate', function(date) {
        if (!date) return '';
        
        const dateObj = new Date(date);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        // Reset hours to compare just the date
        today.setHours(0, 0, 0, 0);
        yesterday.setHours(0, 0, 0, 0);
        const messageDate = new Date(dateObj);
        messageDate.setHours(0, 0, 0, 0);
        
        if (messageDate.getTime() === today.getTime()) {
            return 'Today';
        } else if (messageDate.getTime() === yesterday.getTime()) {
            return 'Yesterday';
        } else {
            return dateObj.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric' 
            });
        }
    });

    // Helper for formatting dates for HTML date input (YYYY-MM-DD)
    hbs.registerHelper('formatDateForInput', function(date) {
        if (!date) return '';
        
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        
        return `${year}-${month}-${day}`;
    });

    // Helper for formatting time
    hbs.registerHelper('formatTime', function(time) {
        if (!time) return '';
        
        const messageDate = new Date(time);
        
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        const messageDay = new Date(messageDate.getFullYear(), messageDate.getMonth(), messageDate.getDate());
        
        let formattedTime = '';
        if (messageDay.getTime() === today.getTime()) {
            formattedTime = 'Today, ';
        } else if (messageDay.getTime() === yesterday.getTime()) {
            formattedTime = 'Yesterday, ';
        } else {
            formattedTime = `${messageDate.getDate()}/${messageDate.getMonth() + 1}/${messageDate.getFullYear()}, `;
        }
        
        const hours = messageDate.getHours();
        const minutes = messageDate.getMinutes();
        formattedTime += `${hours}:${minutes < 10 ? '0' + minutes : minutes}`;
        
        return formattedTime;
    });

    // Helper for formatting relative time (e.g., "2 hours ago")
    hbs.registerHelper('formatTimeAgo', function(date) {
        if (!date) return 'Never';
        
        const now = new Date();
        const diff = now - new Date(date);
        
        // Convert to appropriate units
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        const months = Math.floor(days / 30);
        const years = Math.floor(months / 12);
        
        if (years > 0) {
            return years === 1 ? "1 year ago" : `${years} years ago`;
        } else if (months > 0) {
            return months === 1 ? "1 month ago" : `${months} months ago`;
        } else if (days > 0) {
            return days === 1 ? "1 day ago" : `${days} days ago`;
        } else if (hours > 0) {
            return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
        } else if (minutes > 0) {
            return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;
        } else {
            return "Just now";
        }
    });

    // Helper for pagination
    hbs.registerHelper('times_pagination', function(currentPage, totalPages, options) {
        let accum = '';
        const maxPages = 5; // Show 5 page links at most
        
        let startPage = Math.max(1, currentPage - Math.floor(maxPages / 2));
        let endPage = Math.min(totalPages, startPage + maxPages - 1);
        
        // Adjust start page if we're near the end
        if (endPage - startPage + 1 < maxPages) {
            startPage = Math.max(1, endPage - maxPages + 1);
        }
        
        for (let i = startPage; i <= endPage; i++) {
            accum += options.fn(i);
        }
        
        return accum;
    });

    // Helper for min function
    hbs.registerHelper('min', function(a, b) {
        return Math.min(a, b);
    });

    // Helper for multiply
    hbs.registerHelper('multiply', function(a, b) {
        return a * b;
    });

    // NEW HELPERS FOR CHAT AND CONNECTIONS
    
    // Helper to check if two dates are different days
    hbs.registerHelper('if_different_day', function(date1, date2, options) {
        const day1 = new Date(date1);
        const day2 = new Date(date2);
        
        day1.setHours(0, 0, 0, 0);
        day2.setHours(0, 0, 0, 0);
        
        if (day1.getTime() !== day2.getTime()) {
            return options.fn(this);
        }
        return options.inverse(this);
    });
    
    // Helper for checking array membership
    hbs.registerHelper('if_includes', function(array, item, options) {
        if (!array || !Array.isArray(array)) {
            return options.inverse(this);
        }
        
        if (array.includes(item)) {
            return options.fn(this);
        }
        return options.inverse(this);
    });
    
    // Helper to truncate text
    hbs.registerHelper('truncate', function(text, length) {
        if (!text) return '';
        
        length = parseInt(length) || 30;
        
        if (text.length <= length) {
            return text;
        }
        
        return text.substr(0, length) + '...';
    });
    
    // Helper to format connection duration
    hbs.registerHelper('formatDuration', function(milliseconds) {
        if (!milliseconds) return '';
        
        if (milliseconds < 60000) { // Less than a minute
            const seconds = Math.floor(milliseconds / 1000);
            return `${seconds} ${seconds === 1 ? 'second' : 'seconds'}`;
        } else if (milliseconds < 3600000) { // Less than an hour
            const minutes = Math.floor(milliseconds / 60000);
            return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
        } else if (milliseconds < 86400000) { // Less than a day
            const hours = Math.floor(milliseconds / 3600000);
            return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
        } else {
            const days = Math.floor(milliseconds / 86400000);
            return `${days} ${days === 1 ? 'day' : 'days'}`;
        }
    });
    
    // Helper to count items in an array
    hbs.registerHelper('count', function(array) {
        if (!array || !Array.isArray(array)) {
            return 0;
        }
        return array.length;
    });
    
    // Helper for if/else-if/else conditions
    hbs.registerHelper('if_cond', function(v1, operator, v2, options) {
        switch (operator) {
            case '==':
                return (v1 == v2) ? options.fn(this) : options.inverse(this);
            case '===':
                return (v1 === v2) ? options.fn(this) : options.inverse(this);
            case '!=':
                return (v1 != v2) ? options.fn(this) : options.inverse(this);
            case '!==':
                return (v1 !== v2) ? options.fn(this) : options.inverse(this);
            case '<':
                return (v1 < v2) ? options.fn(this) : options.inverse(this);
            case '<=':
                return (v1 <= v2) ? options.fn(this) : options.inverse(this);
            case '>':
                return (v1 > v2) ? options.fn(this) : options.inverse(this);
            case '>=':
                return (v1 >= v2) ? options.fn(this) : options.inverse(this);
            case '&&':
                return (v1 && v2) ? options.fn(this) : options.inverse(this);
            case '||':
                return (v1 || v2) ? options.fn(this) : options.inverse(this);
            default:
                return options.inverse(this);
        }
    });
    
    // ADD MISSING HELPERS
    
    // Helper for "or" operation - checks if any arguments are truthy
    hbs.registerHelper('or', function() {
        // Convert the arguments object to an array and remove the options object (last argument)
        const args = Array.prototype.slice.call(arguments, 0, arguments.length - 1);
        
        // Return true if any argument is truthy
        return args.some(Boolean);
    });
    
    // Shorthand helper for equal comparison
    hbs.registerHelper('eq', function(a, b) {
        return a === b;
    });
    
    // Helper for checking if a user has no interests
    hbs.registerHelper('noInterests', function(viewedUser) {
        if (!viewedUser || !viewedUser.profile || !viewedUser.profile.interests) {
            return true;
        }
        
        const interests = viewedUser.profile.interests;
        const hasHobbies = interests.hobbies && interests.hobbies.length > 0;
        const hasClasses = interests.classes && interests.classes.length > 0;
        const hasClubs = interests.clubs && interests.clubs.length > 0;
        const hasLanguages = interests.languages && interests.languages.length > 0;
        
        return !(hasHobbies || hasClasses || hasClubs || hasLanguages);
    });
};
// Add these helper functions to your handlebarsHelpers.js file

// Helper to format time
hbs.registerHelper('formatTime', function(timestamp) {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const messageDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    let formattedTime = '';
    if (messageDay.getTime() === today.getTime()) {
        formattedTime = 'Today';
    } else if (messageDay.getTime() === yesterday.getTime()) {
        formattedTime = 'Yesterday';
    } else {
        formattedTime = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
    }
    
    const hours = date.getHours();
    const minutes = date.getMinutes();
    formattedTime += `, ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    
    return formattedTime;
});

// Helper to format time ago
hbs.registerHelper('formatTimeAgo', function(timestamp) {
    if (!timestamp) return 'Never';
    
    const now = new Date();
    const date = new Date(timestamp);
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 60) {
        return 'Just now';
    }
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
        return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
    }
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
        return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
    }
    
    const days = Math.floor(hours / 24);
    if (days < 30) {
        return `${days} ${days === 1 ? 'day' : 'days'} ago`;
    }
    
    const months = Math.floor(days / 30);
    if (months < 12) {
        return `${months} ${months === 1 ? 'month' : 'months'} ago`;
    }
    
    const years = Math.floor(months / 12);
    return `${years} ${years === 1 ? 'year' : 'years'} ago`;
});

// Helper for conditional equals comparison in handlebars
hbs.registerHelper('if_eq', function(a, b, opts) {
    if (a == b) {
        return opts.fn(this);
    } else {
        return opts.inverse(this);
    }
});

// Helper for subtraction
hbs.registerHelper('subtract', function(a, b) {
    return a - b;
});