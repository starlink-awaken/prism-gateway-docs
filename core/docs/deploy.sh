#!/bin/bash
# Deployment script for PRISM-Gateway API Documentation

set -e

echo "🚀 PRISM-Gateway API Documentation Deployment"
echo "==========================================="

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if docs directory exists
if [ ! -d "docs/api" ]; then
    echo -e "${BLUE}Creating docs/api directory...${NC}"
    mkdir -p docs/api
fi

# Verify documentation files
echo -e "${BLUE}Verifying documentation files...${NC}"
DOCS=(
    "README.md"
    "GatewayGuard.md"
    "MemoryStore.md"
    "DataExtractor.md"
    "RetrospectiveCore.md"
    "QuickReview.md"
    "PatternMatcher.md"
    "PrincipleChecker.md"
    "TrapDetector.md"
)

for doc in "${DOCS[@]}"; do
    if [ -f "docs/api/$doc" ]; then
        echo -e "${GREEN}✓${NC} $doc"
    else
        echo "✗ $doc (missing)"
        exit 1
    fi
done

echo ""
echo -e "${GREEN}✓${NC} All documentation files verified"
echo ""

# For GitHub Pages deployment
if [ "$1" == "--gh-pages" ]; then
    echo -e "${BLUE}Preparing for GitHub Pages deployment...${NC}"

    # Create .nojekyll file
    touch docs/api/.nojekyll

    echo -e "${GREEN}✓${NC} Ready for GitHub Pages deployment"
    echo ""
    echo "To deploy to GitHub Pages:"
    echo "1. git add docs/api"
    echo "2. git commit -m 'Update API documentation'"
    echo "3. git push"
fi

# Summary
echo ""
echo "==========================================="
echo -e "${GREEN}✓${NC} Documentation deployment complete!"
echo ""
echo "Documentation location: docs/api/"
echo "Total files: ${#DOCS[@]}"
echo ""
echo "To serve locally:"
echo "  bun run docs:serve"
echo ""
echo "Then open: http://localhost:8080"
