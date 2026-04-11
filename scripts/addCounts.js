const fs = require('fs');

let content = fs.readFileSync('src/Component/Home/Admin.jsx', 'utf8');

// Replace filter button labels with counts
content = content.replace(
    ">\n                                        All\n                                    </button>",
    ">\n                                        All({properties.length})\n                                    </button>"
);

content = content.replace(
    ">\n                                        Pending\n                                    </button>",
    ">\n                                        Pending({properties.filter(p => p.status === 'pending').length})\n                                    </button>"
);

content = content.replace(
    ">\n                                        Approved\n                                    </button>",
    ">\n                                        Approved({properties.filter(p => p.status === 'approved').length})\n                                    </button>"
);

content = content.replace(
    ">\n                                        Rejected\n                                    </button>",
    ">\n                                        Rejected({properties.filter(p => p.status === 'rejected').length})\n                                    </button>"
);

fs.writeFileSync('src/Component/Home/Admin.jsx', content);

console.log('Done! Added property counts to filter buttons.');
