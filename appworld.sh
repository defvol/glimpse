cp -R app glimpse
cd glimpse/

# Remove unnecessary files
rm README.md 
rm -Rf bin/
rm QUnit.html 
rm .DS_Store 

# Compress scripts
cd js/
cat bestImage.js feeds.js greader.js results.js > teiga.js
java -jar ../../yuicompressor-2.4.2.jar --type js -o teiga-min.js teiga.js 
cat jquery-1.5.min.js teiga-min.js > scripts.min.js
mv scripts.min.js ..
rm *
cd ..
mv scripts.min.js js/results.js

# Remove unnecessary script references
sed '/bestImage.js/d' index.html > index.tmp
mv index.tmp index.html
sed '/feeds.js/d' index.html > index.tmp
mv index.tmp index.html
sed '/greader.js/d' index.html > index.tmp
mv index.tmp index.html

