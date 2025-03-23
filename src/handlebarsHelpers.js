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
        
        const d = new Date(date);
        return d.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
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
        
        const d = new Date(time);
        let hours = d.getHours();
        let minutes = d.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        
        hours = hours % 12;
        hours = hours ? hours : 12; // the hour '0' should be '12'
        minutes = minutes < 10 ? '0'+minutes : minutes;
        
        return `${hours}:${minutes} ${ampm}`;
    });

    // Helper for formatting relative time (e.g., "2 hours ago")
    hbs.registerHelper('formatTimeAgo', function(date) {
        if (!date) return '';
        
        const d = new Date(date);
        const now = new Date();
        const diffMs = now - d;
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHour = Math.floor(diffMin / 60);
        const diffDay = Math.floor(diffHour / 24);
        const diffMonth = Math.floor(diffDay / 30);
        const diffYear = Math.floor(diffMonth / 12);
        
        if (diffYear > 0) {
            return diffYear === 1 ? '1 year ago' : `${diffYear} years ago`;
        } else if (diffMonth > 0) {
            return diffMonth === 1 ? '1 month ago' : `${diffMonth} months ago`;
        } else if (diffDay > 0) {
            return diffDay === 1 ? '1 day ago' : `${diffDay} days ago`;
        } else if (diffHour > 0) {
            return diffHour === 1 ? '1 hour ago' : `${diffHour} hours ago`;
        } else if (diffMin > 0) {
            return diffMin === 1 ? '1 minute ago' : `${diffMin} minutes ago`;
        } else {
            return 'Just now';
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
};