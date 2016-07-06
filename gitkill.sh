git filter-branch --tree-filter 'rm -rf $deldir' --prune-empty HEAD
git for-each-ref --format="%(refname)" refs/original/ | xargs -n 1 git update-ref -d
echo $deldir/ >> .gitignore
git add .gitignore
git commit -m 'Removing $deldir from git history'
git gc
git push origin master --force
