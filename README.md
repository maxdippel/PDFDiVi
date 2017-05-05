PDFDiVi

#   1 Setup
#   1.1 Python
    Install following modules if needed (you might need sudo)
    pip3
                apt-get install python3-pip
    reportlab
                pip3 install reportlab
    PyPDF2
                pip3 install PyPDF2
    gevent
                pip3 install gevent
    
#   1.2 General
#   1.2.1 Encoding
    Make sure encoding is set to UTF-8 (check via locale charmap)
    Change (if needed) by executing:
                export LC_ALL=en_US.UTF-8
                export LANG=en_US.UTF-8
                export LANGUAGE=en_US.UTF-8
    To save these permanently you may add them in ~/.bashrc (create if missing).
    If this is not run automatically you may add the following lines to ~/.profile (create if missing).
                if [ -n "$BASH_VERSION" ]; then
                    # include .bashrc if it exists
                    if [ -f "$HOME/.bashrc" ]; then
                        . "$HOME/.bashrc"
                    fi
                fi
                
    Also make sure to have page size of documents created from LaTeX files set to A4:
                sudo paperconfig -p a4

    
#   1.2.2 pdflatex
    Install pdflatex if needed:
                sudo apt install texlive-latex-base
    
    As you need some special sty-files, execute
                export TEXMFHOME=<PATH>/PDFDiVi/texmf
                    where <PATH> is the location of the PDFDiVi project
    To save this permanently, you may add it in ~/.bashrc (see 1.2.1).

#   1.2.3. CORS
    To be able to load files (like PDFs) dynamically, CORS must be activated. To do so, add the line
    'Header set Access-Control-Allow-Origin "*"' to the .htaccess file in the top-level folder.
    Note: In order that this .htaccess file is processed by Apache, you have to set the 'AllowOverride'
    directive to 'FileInfo' in your VirtualHost file (like /etc/apache2/site-available/000-default.conf):
 	<Directory "/var/www/html/PDFDiVi/">
                # Enable the use of .htaccess files.
                AllowOverride FileInfo
        </Directory>

#   2 Workflow
    Assuming you have all needed source files in their corresponding folders you can execute
    the following command in the *evaluation* directory
                make evaluate TOOL=pdftotext PREFIX=cond-mat0001220
    This means that you are evaluating the differences to the tool pdftotext on the files in
    the folder cond-mat0001220
