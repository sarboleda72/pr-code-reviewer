# PR Code Reviewer

Automated Pull Request code structure reviewer that validates common project patterns and best practices.

## 🎯 What it validates

### ✅ Current Features
- **Gitignore Analysis**: Checks if `.gitignore` exists and contains essential rules
- **Environment Files**: Detects committed `.env` files that shouldn't be in the repo
- **Dependency Folders**: Ensures `node_modules/`, `.venv/`, etc. aren't committed

### 🔮 Coming Soon
- Project structure validation (src/, controllers/, services/)
- Code pattern analysis
- Security checks
- Documentation requirements

## 🚀 Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Test locally
```bash
# Test on current directory
npm test

# Test on specific project
node test/test-analyzer.js /path/to/your/project

# Debug mode
node test/test-analyzer.js /path/to/project --debug
```

### 3. Run as API server
```bash
npm start
# or for development
npm run dev
```

### 4. Test via API
```bash
curl -X POST http://localhost:3000/analyze \
  -H "Content-Type: application/json" \
  -d '{"projectPath": "/path/to/project"}'
```

## 📁 Project Structure

```
pr-code-reviewer/
├── src/
│   ├── analyzers/
│   │   ├── gitignore-analyzer.js    # Validates .gitignore
│   │   ├── env-analyzer.js          # Checks for .env files
│   │   └── dependency-analyzer.js   # Validates dependencies
│   ├── code-reviewer.js             # Main orchestrator
│   └── app.js                       # Express API server
├── rules/
│   ├── general-rules.json           # General validation rules
│   └── nodejs-rules.json            # Node.js specific rules
├── test/
│   └── test-analyzer.js             # Local testing script
└── README.md
```

## ⚙️ Configuration

Rules are defined in JSON files in the `rules/` directory:

### General Rules (`rules/general-rules.json`)
```json
{
  "general": {
    "requiredFiles": [".gitignore"],
    "prohibitedFiles": [".env", ".env.local"],
    "prohibitedFolders": ["node_modules", ".venv"]
  }
}
```

### Project-specific Rules (`rules/nodejs-rules.json`)
```json
{
  "nodejs": {
    "requiredFiles": [".gitignore", "package.json"],
    "gitignoreRules": ["node_modules/", ".env*", "dist/"]
  }
}
```

## 📊 Example Output

```
🤖 Code Structure Review

📁 Project: my-awesome-app
🔧 Type: nodejs
📊 Summary: 5 passed, 2 failed, 1 warnings

❌ Issues Found
❌ Environment file found: .env
   💡 Remove '.env' from repository and add it to .gitignore

⚠️  Warnings
⚠️  No lockfile found (package-lock.json or yarn.lock)
   💡 Consider committing your lockfile to ensure consistent dependency versions

✅ Good Practices Found
✅ .gitignore file found
✅ .gitignore includes: node_modules/
✅ package.json found
```

## 🔗 Integration Options

### Option 1: GitHub Actions
- Copy workflow file to projects
- Runs on every PR automatically
- Comments directly on PRs

### Option 2: GitHub App
- Install once, works on multiple repos
- More powerful GitHub integration
- Can act as official reviewer

## 🛠️ Development

### Adding New Analyzers

1. Create new analyzer in `src/analyzers/`
2. Implement `analyze(projectPath, rules)` method
3. Add to `src/code-reviewer.js`
4. Update rules in `rules/*.json`

### Example Analyzer Structure
```javascript
class MyAnalyzer {
  constructor() {
    this.name = 'My Analyzer';
  }
  
  analyze(projectPath, rules) {
    return {
      analyzer: this.name,
      passed: [],
      failed: [],
      warnings: []
    };
  }
}
```

## 📝 TODO

- [ ] GitHub App integration
- [ ] More project types (Python, Java, etc.)
- [ ] Structure analysis (folder organization)
- [ ] Security pattern detection
- [ ] Custom rule configuration UI
- [ ] Integration with popular CI/CD platforms

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Test your changes locally
4. Submit a pull request

---

**Made with ❤️ for better code reviews**