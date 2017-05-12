page_width = 0
page_height = 0
txt_content = null
pdf_content = null
init = false
total_replace = 0
total_insert = 0
total_merge = 0
total_split = 0
total_delete = 0
total_rearrange = 0
total_operations = 0
page_idx = 1
page_max = 0
_pdfDoc = null
annotation_y_index = 0

function setup(viewport, _finished) {
    init = true
    page_width = viewport.width
    page_height = viewport.height
    //scale = desired_width*1.0 /page_width
    //alert(scale)
    _finished();
}

scale = 2.0
zoom = 0.5
desired_width = 800
page_padding = 20
function renderPDF(url, canvasContainer, _finished, options) {
    var options = options || { scale: 1 };
    init = false
    function renderPage(page) {
        if (!init) {setup(page.getViewport(options.scale), _finished)}
        viewport = page.getViewport(scale); 
        
        var canvas = document.createElement('canvas');
        canvas.style.marginBottom = page_padding + "px"
        canvas.style.boxShadow = "5px 5px 10px black"
        var ctx = canvas.getContext('2d');
        var renderContext = {
          canvasContext: ctx,
          viewport: viewport
        };
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        canvasContainer.appendChild(canvas);
        
        page.render(renderContext);
        page_idx++;
        if (page_idx <= page_max) {
            _pdfDoc.getPage(page_idx).then(renderPage);
        }
    }
    function renderPages(pdfDoc) {
        page_max = pdfDoc.numPages;
        _pdfDoc = pdfDoc;
        pdfDoc.getPage(page_idx).then(renderPage);

    }

    PDFJS.disableWorker = true;
    PDFJS.getDocument(url).then(renderPages);
            
}

loaded = false
function readTXT() {
    txt_name = document.getElementById("INPUT_TXT").innerHTML;
    var xhr = new XMLHttpRequest();
    xhr.open('GET', txt_name, true);
    xhr.responseType = 'text';

    xhr.onload = function(e) {
        txt_content = this.response;
        if (!loaded && pdf_content) {
            loaded = true;            
            setupAnnotations(pdf_content, txt_content);
        }
    };
    xhr.send();
}

pdf_name = ""

function readPDF() {
    pdf_name = document.getElementById("INPUT_PDF").innerHTML;
    
    var xhr = new XMLHttpRequest();
    xhr.open('POST', pdf_name, true);
    //xhr.withCredentials = true;
    xhr.responseType = 'arraybuffer';

    xhr.onload = function(e) {
        pdf_content = new Uint8Array(this.response);
        if (!loaded && txt_content) {
            loaded = true;            
            setupAnnotations(pdf_content, txt_content);
        }
    };
    xhr.send();

}

replace_color = "rgba(0, 255, 255, 0.3)";
insert_color = "rgba(255, 255, 0, 0.3)";
delete_color = "rgba(255, 0, 0, 0.3)";
rearrange_color = "rgba(255, 140, 0, 0.3)";
merge_color = "rgba(0, 255, 0,  0.3)";
split_color = "rgba(147,112,219,  0.3)";
side_note_width = 3;

annotations_by_y = [];


function setupAnnotations(pdf_path, annotations) {
    renderPDF(pdf_path, document.getElementById('pdf_container'),
    function() {
        annotations = annotations.split(">>");
        page_height-= 0.8/scale;
        for (var i = 1; i < annotations.length; i++) {  //skip empty element
            var annotation = annotations[i].split(/\n/);
            var type = annotation[1].split("|")[0];
            var op_type = annotation[1].split("|")[1];
            var framed = op_type == "word";
            
            var framed_shift = framed ? side_note_width : 0;
            var rects = annotation[2].split("|");
            var actual = "";
            var target = "";
            var k = 0;
            for (var j = 3; j < annotation.length; j++) {
                k = j + 1;
                if (annotation[j] == "--") {break;}
                var s = actual == "" ? "" : "\n";
                actual += s + annotation[j];
            }
            for (var j = k; j < annotation.length; j++) {
                var s = target == "" ? "" : "\n";
                target += s + annotation[j];
            }
            var color = "blue"
            var note = ""
            total_operations++;
            switch(type) {
                case "Replace":
                    processOperation("REPLACE", rects[1].split(" "),rects,replace_color,actual+"\n<b>BY</b>\n"+target,10+0* side_note_width+framed_shift,side_note_width,page_height,page_padding, total_replace, framed)
                    total_replace++;
                    break;
                case "Insert":
                    processOperation("INSERT", rects[1].split(" "), rects, insert_color, target, 10 + 2 * side_note_width + framed_shift, side_note_width, page_height, page_padding, total_insert, framed)
                    total_insert++;
                    break;
                case "Delete":
                    processOperation("DELETE", rects[1].split(" ") , rects, delete_color, actual,10+6*side_note_width + framed_shift, side_note_width, page_height, page_padding, total_delete, framed)  //rects[rects.length - 1].split(" ")
                    total_delete++;
                    break;
                case "Rearrange":
                    processOperation("REARRANGE", rects[1].split(" "), rects, rearrange_color, target, 10 + 6 * side_note_width + framed_shift, side_note_width, page_height, page_padding, total_rearrange, framed)
                    total_rearrange++;
                    break;
                case "Merge":
                    processOperationShort("MERGE", rects[1].split(" "), 20, merge_color, "Insert a <b>MERGE</b> here.", 10 + 8 * side_note_width + framed_shift, side_note_width, page_height, page_padding, total_merge, framed)
                    total_merge++;
                    break;
                case "Split":
                    processOperationShort("SPLIT", rects[1].split(" "), 20, split_color, "Insert a <b>SPLIT</b> here.", 10 + 8 * side_note_width + framed_shift, side_note_width, page_height, page_padding, total_split, framed)
                    total_split++;
                    break;
            }
            
        }
        document.getElementById("pdf_title").innerHTML = pdf_name;
        document.getElementById("content").style.left = (($(window).width()/2 - page_width*(scale*zoom)/2) / $(window).width() * 100).toString() + "%";
        createDistributionWindow();
        annotations_by_y.sort();
    }
    );
    
}

function processOperation(type, rect, rects, color, note, xshift, side_note_width, page_height, page_padding, id, framed) {
    var anchor_page = parseInt(rect[0]);
    var anchor_x = rect[1];
    var y = rect[2];
    var width = rect[3];
    var anchor_height = rect[4];
    var add_y = framed ? anchor_height*1.0 : 0;
    var anchor_y = y*1.0 + add_y;
    addAnnotation(xshift, y - anchor_height + (anchor_page-1) * (page_height+page_padding*zoom), side_note_width, anchor_height, color.replace("0.3", "0.7"), note, type, id, framed, anchor_x, anchor_y- anchor_height + (anchor_page-1) * (page_height+page_padding*zoom))
    for (var j = 1; j < rects.length; j++) {
        var rect = rects[j].split(" ");
        var page = parseInt(rect[0]);
        var x = rect[1];
        var y = rect[2];
        var width = rect[3];
        var height = rect[4];
        addAnnotation(x, y - height + (page-1) * (page_height+page_padding*zoom), width, height, color, note, type, id, framed, anchor_x, anchor_y- anchor_height + (anchor_page-1) * (page_height+page_padding*zoom))
    }
}

function processOperationShort(type, rect, length, color, note, xshift, side_note_width, page_height, page_padding, id, framed) {
    var page = parseInt(rect[0]);
    var x = rect[1];
    var y = rect[2];
    var width = rect[3];
    var height = rect[4];
    var add_y = framed ? height*1.0 : 0;
    var anchor_y = y*1.0 + add_y;
    addAnnotation(x, y - height + (page-1) * (page_height+page_padding*zoom), length, height, color, note, type, id, framed, x, anchor_y- height + (page-1) * (page_height+page_padding*zoom))
    addAnnotation(xshift, y - height + (page-1) * (page_height+page_padding*zoom), side_note_width, height, color.replace("0.3", "0.7"), note, type, id, framed, x, anchor_y- height + (page-1) * (page_height+page_padding*zoom))
}

function getXShift() {
    return ($(window).width()/2 - page_width*(scale*zoom)/2);
}


dialog_id = 0;
grouped_annotations = {};
last_group_id = -1
function addAnnotation(x, y, width, height, color, note, title="", group_id, framed=false, anchor_x, anchor_y) {
    if (group_id != last_group_id) {
        annotations_by_y.push(y*scale);
    }
    last_group_id = group_id;
    var window = document.getElementById(title + "_container")
    if (window == null) {
        var container = document.createElement('div');
        container.id = title + "_container";
        document.getElementById('annotations').appendChild(container);
        $("#" + title + "_container").addClass("annotation_container");
    }


    var annotation = document.createElement('div');
    annotation.id = 'annotation';// + group_id.toString();
    annotation.style.fontSize= "8";
    annotation.style.width= (width*scale).toString() + "px";
    annotation.style.height= (height*scale).toString() + "px";
    annotation.style.left= (x*scale).toString() + "px";
    annotation.style.top= (y*scale).toString() + "px";
    var line = height*scale/5.0;
    
    if (framed) {
        annotation.style.borderBottom = line.toString() + "px solid " + color.replace(0.3, 1);
        annotation.style.backgroundColor= "transparent";
    }
    else {
        annotation.style.backgroundColor= color;
    }
    var idx = title + group_id.toString(); //dialog_id
    var id = "dialog_"+ title + idx;//idx;
    if (!(id in grouped_annotations)) {
        grouped_annotations[id] = [];
    }
    grouped_annotations[id].push(annotation)
    annotation.onclick = function() {
        var dialog = document.getElementById(id);
        var cur_x = x;
        var cur_y = y;
        var opened = false;
        
        for (var i = 0; i < grouped_annotations[id].length; i++) {
            grouped_annotations[id][i].style.backgroundColor= color.replace("0.3", "0.5");
        }
                //annotation.style.backgroundColor= color.replace("0.3", "1");
        if (dialog) {
            if ($('#' + id).dialog('isOpen')) {
                $('#' + id).dialog('close');
                for (var i = 0; i < grouped_annotations[id].length; i++) {
                    grouped_annotations[id][i].style.backgroundColor= framed ? "transparent" : color;
                }
                //annotation.style.backgroundColor= color;
                
            }
            else {
                
                var d = $("#"+id).dialog({
                    collision:"none",
                    modal:false,
                    resizable:false,
                }).dialog( "option", "position", { my: "top", at: "bottom", of: annotation, 
                collision: 'none' } );
                
                d.prev(".ui-dialog-titlebar").css({"background" : color.replace("0.7", "0.3")});
                d.css({height: Math.min(350, $("#"+id).height()).toString() +  "px", overflow:"auto"});
            
                var line = createLine(getXShift() + anchor_x*scale*zoom, (anchor_y)*scale*zoom  , $("#"+id).offset().left, $("#"+id).offset().top, color.replace("0.7", "0.3"));
                line.id = "line"+idx;
                document.body.appendChild(line);
            }
            
        }
        else {
            //dialog_id += 1;
            var popup = document.createElement('div');
            popup.id = id;
            popup.title = title + " " + (title == "SPLIT" || title == "MERGE" ? "" : (framed ? "WORD" : "PARAGRAPH"));
            note = note.split("\n").join('<br/>');
            note = note.split("<AND>").join('<b>AND</b>');
            popup.innerHTML = note;
            document.getElementById('popup_container').appendChild(popup);
            var posX = $(this).offset().left - $(document).scrollLeft() - width + $(this).outerWidth();
            var posY = $(this).offset().top - $(document).scrollTop() + $(this).outerHeight();
            
            var d = $("#"+id).dialog({
                collision:"none",
                modal:false,
                resizable:false,
            }).dialog( "option", "position", { my: "top", at: "bottom", of: annotation, 
        collision: 'none' } );
            d.prev(".ui-dialog-titlebar").css({"background" : color.replace("0.7", "0.3")});
            d.css({height: Math.min(350, $("#"+id).height()).toString() +  "px", overflow:"auto"});
            var line = createLine(getXShift() +  anchor_x*scale*zoom, (anchor_y)*scale*zoom  , $("#"+id).offset().left, $("#"+id).offset().top, color.replace("0.7", "0.3"));
            line.id = "line"+idx;
            document.body.appendChild(line);
            
            $("#"+id).bind("dialogdragstart", function()
            {
                
                document.getElementById("GUI").style.right = getScrollbarWidth().toString() + "px";
                $('body').addClass('stop-scrolling');
                var element = document.getElementById("line"+idx);
                if (element) {
                    element.parentNode.removeChild(element);
                }
                    
            });

            $("#"+id).bind("dialogdragstop", function()
            {
                document.getElementById("GUI").style.right = "0px";
                $('body').removeClass('stop-scrolling');
                $('GUI').removeClass('scrolling-margin');
                var line = createLine(getXShift() +  anchor_x*scale*zoom, (anchor_y)*scale*zoom, $("#"+id).offset().left, $("#"+id).offset().top, color.replace("0.7", "0.3"));
                line.id = "line"+idx;
                    document.body.appendChild(line);    
            });

            $("#"+id).bind("dialogclose", function()
            {
                
                var element = document.getElementById("line"+idx);
                if (element) {
                    element.parentNode.removeChild(element);
                }
                for (var i = 0; i < grouped_annotations[id].length; i++) {
                    grouped_annotations[id][i].style.backgroundColor= framed ? "transparent" : color;
                }
                    
            });
        }




        
        
    

    };
    document.getElementById(title + "_container").appendChild(annotation);

}

function addCheckboxListener(name) {
    $('#show_'+name).change(function(){
        var window = document.getElementById(name.toUpperCase() + "_container")
        if($(this).is(':checked'))
        {
            window.style.display = "block";
        }
        else
        {
            window.style.display = "none";
        }    

    });
}

function activateGUIElement(new_window, new_button) {
    var window = document.getElementById(new_window)
    var button = document.getElementById(new_button)
    if (window == null) return;
    if (window.style.display == "none") {
        if (current_window != "") {
            activateGUIElement(current_window, current_button);
        }
        current_window = new_window;
        current_button = new_button;
        window.style.display = "block";
        //button.style.backgroundColor = "rgba(100,100,100,0.8)";/*"#808080";*/
        button.style.backgroundImage = "linear-gradient(to top, rgba(50,50,50,0) 0%, rgba(100,100,100,0.8) 50%)";
        //window.style.backgroundColor = "rgba(100,100,100,0.8)";/*"#808080";*/
        
    }
    else {
        current_window = "";
        current_button = "";
        window.style.display = "none";
        button.style.backgroundImage = "linear-gradient(to top, rgba(50,50,50,0) 0%, rgba(100,100,100,0) 50%)";
        //button.style.backgroundColor = "rgba(200,200,200,0)";/*#bdbdbd;*/
    }
}
function removeGUIElement(window, button, force_quit=false) {
    var window = document.getElementById(window)
    var button = document.getElementById(button)
    if (window != null) window.remove();
    button.style.backgroundColor = "#bdbdbd";
}

var current_window = "";
var current_button = "";


function createAboutWindow(){
    var about_window = document.createElement('div');
    about_window.style.display = "none";
    about_window.id = "about_window";
    about_window.innerHTML = "<b>About</b></br></br>";
        

    about_window.style.position = "relative";
    about_window.innerHTML += "<img style='position:absolute; right:0px; top:0px' src='http://sirba.informatik.privat/PDFDiVi/evaluation/source/images/information.png'/></br>";
    about_window.innerHTML += "PDFDiVi is an application for visualizing differences in text extraction between some tool and our benchmark. \
    </br></br>\
    In order to provide a good measure of quality, we foucs on the operations needed to transform the extraction by the tool into the benchmark extraction.</br>\
    When visualizing our different operations we distinguish between word and paragraph operations. These can be seen as the two main classes of operation types. \
    As their names suggest they differ in the scope, as word operations are dealing only with single characters or words while paragraph operation may deal with sequences of words.</br> \
    One can see the difference between both general types of operations in the visualization as well as in the explanation notes. Word Operation underline marked text while paragraph operations color\ the whole background of the respective text part. Furthermore there is a type specification in the title of each explanation node (you may open it by clicking on highlighted text).";

    
    document.getElementById('info_container').appendChild(about_window);
    $("#about_window").addClass("info");
    $("#about_window").addClass("framed");
}


function createLegendWindow() {
    var legend_window = document.createElement('div');
    legend_window.style.display = "none";
    legend_window.id = "legend_window";
    legend_window.innerHTML = "<b>Legend</b></br>";

    legend_window.style.position = "relative";
    legend_window.innerHTML += "<img style='position:absolute; right:0px; top:0px' src='http://sirba.informatik.privat/PDFDiVi/evaluation/source/images/star.png'/></br>"

    var l1 = new Array(
    "States that there is a text part missing",
    "States that there is a text part which differs",
    "States that there was a break in the textflow which doesn't correspond to the benchmark",
    "States that there should be a break in the textflow which wasn't extracted by the tool",
    "States that there is a text part which has a different localization (in the text flow)",
    "States that there is a text part which shouldn't have been extracted");
    var l2 = new Array(insert_color, replace_color, merge_color, split_color, rearrange_color, delete_color);
    var l3 = new Array("Insert", "Replace", "Merge", "Split", "Rearrange", "Delete");
    for (i = 0; i < l3.length; i++) {
        // 
        c = l2[i]
        if (c != "white")
            c = c.replace(0.3, 0.8);
        legend_window.innerHTML += "<span style='color:"+c+"'><b>" + l3[i] + "</b></span></br>";
        legend_window.innerHTML += l1[i] + "</br></br>";
    }
    document.getElementById('info_container').appendChild(legend_window);
    $("#legend_window").addClass("info");
    $("#legend_window").addClass("framed");
    

    for (var j = 0; j < l3.length; j++) {
        addCheckboxListener(l3[j]);
    }
}

function createOptionsWindow() {
    var options_window = document.createElement('div');
    options_window.style.display = "none";
    options_window.id = "options_window";
    options_window.innerHTML = "<b>Options</b></br>";

    options_window.style.position = "relative";
    options_window.innerHTML += "<img style='position:absolute; right:0px; top:0px' src='http://sirba.informatik.privat/PDFDiVi/evaluation/source/images/gear.png'/></br>"

    var l2 = new Array(insert_color, replace_color, merge_color, split_color, rearrange_color, delete_color);
    var l3 = new Array("Insert", "Replace", "Merge", "Split", "Rearrange", "Delete");
    for (var i = 0; i < l3.length; i++) {
        // 
        c = l2[i]
        if (c != "white")
            c = c.replace(0.3, 0.8);
        options_window.innerHTML += "<input type='checkbox' id='show_" + l3[i] + "' checked>"
        options_window.innerHTML += "   <span style='color:"+c+"'><b>" + l3[i] + "</b></span></br>"
    }
    document.getElementById('info_container').appendChild(options_window);
    $("#options_window").addClass("info");
    $("#options_window").addClass("framed");
    

    for (var j = 0; j < l3.length; j++) {
        addCheckboxListener(l3[j]);
    }
}

function createDistributionWindow() {
    var distribution_window = document.createElement('div');
    distribution_window.style.display = "none";
    distribution_window.id = "distribution_window";
    distribution_window.innerHTML = "<b>Distribution</b></br>";

    distribution_window.style.position = "relative";
    distribution_window.innerHTML += "<img style='position:absolute; right:0px; top:0px' src='http://sirba.informatik.privat/PDFDiVi/evaluation/source/images/signal3.png'/></br>"

    var table = document.createElement('table');
    table.cellPadding = "0px 10px 0px 10px";
    table.style.color = "white";
    var l1 = new Array(total_insert, total_replace, total_merge, total_split, total_rearrange, total_delete, total_operations);
    var l2 = new Array(insert_color, replace_color, merge_color, split_color, rearrange_color, delete_color, "white");
    var l3 = new Array("Insert", "Replace", "Merge", "Split", "Rearrange", "Delete", "Total");
    for (i = 0; i < l3.length; i++) {
        // 
        c = l2[i]
        if (c != "white")
            c = c.replace(0.3, 0.8);
        table.innerHTML += "<tr><td><b>" + l1[i] + "</b></td><td style='padding: 0px 10px'>" + "<span style='color:"+c+"'><b>" + l3[i] + "</b></span></td></tr>"
    }
    document.getElementById('info_container').appendChild(distribution_window);
    document.getElementById('distribution_window').appendChild(table);
    $("#distribution_window").addClass("info");
    $("#distribution_window").addClass("framed");
}

$(document).ready(function () {
    $(window).on('resize', function(){
        document.getElementById("content").style.left = (($(this).width()/2 - page_width*(scale*zoom)/2) / $(this).width() * 100).toString() + "%";
        $(".ui-dialog-content").dialog("close");
    });
    
    createAboutWindow();
    createLegendWindow();
    createOptionsWindow();
     // TODO: distribution
            
    document.getElementById('about').addEventListener('click', function() {activateGUIElement("about_window", "about")}, false);
    document.getElementById('legend').addEventListener('click', function() {activateGUIElement("legend_window", "legend")}, false);
    document.getElementById('options').addEventListener('click', function() {activateGUIElement("options_window", "options")}, false);
    document.getElementById('distribution').addEventListener('click', function() {activateGUIElement("distribution_window", "distribution")}, false);
    
    
    document.getElementById('clear').addEventListener('click', function() {$(".ui-dialog-content").dialog("close");}, false);


    document.getElementById('up').addEventListener('click', function() {
        var y = $(window).scrollTop();  //your current y position on the page
        $(window).scrollTop(y-(page_height+0.5*page_padding)*(zoom*scale));
    }, false);

    document.getElementById('down').addEventListener('click', function() {
        var y = $(window).scrollTop();  //your current y position on the page
        $(window).scrollTop(y+(page_height+0.5*page_padding)*(zoom*scale));
    }, false);

    
        
    document.getElementById('zoom_in').addEventListener('click', function() {
        zoomTo(Math.min(zoom + 0.1, 0.5 * ($(window).width()/(page_width))));
    }, false);

    document.getElementById('zoom_out').addEventListener('click', function() {
        zoomTo(Math.max(zoom - 0.1, 0.3));
        
    }, false);
    
    
    document.getElementById('fill_width').addEventListener('click', function() {
        zoomToWidth();
    }, false);
    
    document.getElementById('fill_height').addEventListener('click', function() {
        zoomToHeight();
    }, false);
    
    document.getElementById('next').addEventListener('click', function() {
        annotation_y_index = Math.min(annotations_by_y.length - 1, annotation_y_index +1);
        $(window).scrollTop(annotations_by_y[annotation_y_index]*(zoom*scale)); //annotation_y_index
    }, false);
    
    document.getElementById('previous').addEventListener('click', function() {
        annotation_y_index = Math.max(0, annotation_y_index -1);
        $(window).scrollTop(annotations_by_y[annotation_y_index]*(zoom*scale)); //annotation_y_index
    }, false);
    
    
    readPDF();
    readTXT();
    zoomTo(0.5);
    

});

function zoomTo(amount) {
    zoom = amount;
    var ratio = zoom * scale
    document.getElementById("content").style.transform = "scale("+zoom.toString()+")";
    document.getElementById("content").style.mozTransform = "scale("+zoom.toString()+")";
    document.getElementById("content").style.webkitTransform = "scale("+zoom.toString()+")";
    document.getElementById("content").style.msTransform = "scale("+zoom.toString()+")";
    document.getElementById("content").style.left = (($(window).width()/2 - page_width*ratio/2) / $(window).width() * 100).toString() + "%";
    $(".ui-dialog-content").dialog("close");
} 

function zoomToWidth() {
    zoom = 0.5 * ($(window).width()/(page_width));
    zoomTo(zoom);
} 
function zoomToHeight() {
    zoom = 0.5 * ($(window).height()/(page_height));
    zoomTo(zoom);
}

function reset() {
    $("#annotations").empty();
    $("#pdf_container").empty();
    $(".ui-dialog-content").dialog("close");
    removeGUIElement('distribution_window', 'distribution')
    removeGUIElement('options_window', 'options')
    //alert("setup_annotations")
    total_replace = 0
    total_insert = 0
    total_merge = 0
    total_split = 0
    total_delete = 0
    total_rearrange = 0
    total_operations = 0
    page_idx = 1
    //dialog_id = 0
}


function createLineElement(x, y, length, angle, color) {
    var line = document.createElement("div");
    var styles = 'border: 1px solid ' + color + '; '
               + 'width: ' + length + 'px; '
               + 'height: 0px; '
               + '-moz-transform: rotate(' + angle + 'rad); '
               + '-webkit-transform: rotate(' + angle + 'rad); '
               + '-o-transform: rotate(' + angle + 'rad); '  
               + '-ms-transform: rotate(' + angle + 'rad); '  
               + 'position: absolute; '
               + 'top: ' + y + 'px; '
               + 'left: ' + x + 'px; ';
    line.setAttribute('style', styles);  
    return line;
}

function createLine(x1, y1, x2, y2, color) {
    var a = x1 - x2,
        b = y1 - y2,
        c = Math.sqrt(a * a + b * b);

    var sx = (x1 + x2) / 2,
        sy = (y1 + y2) / 2;

    var x = sx - c / 2,
        y = sy;

    var alpha = Math.PI - Math.atan2(-b, a);

    return createLineElement(x, y, c, alpha, color);
}

function getScrollbarWidth() {
    var outer = document.createElement("div");
    outer.style.visibility = "hidden";
    outer.style.width = "100px";
    outer.style.msOverflowStyle = "scrollbar"; // needed for WinJS apps

    document.body.appendChild(outer);

    var widthNoScroll = outer.offsetWidth;
    // force scrollbars
    outer.style.overflow = "scroll";

    // add innerdiv
    var inner = document.createElement("div");
    inner.style.width = "100%";
    outer.appendChild(inner);        

    var widthWithScroll = inner.offsetWidth;

    // remove divs
    outer.parentNode.removeChild(outer);

    return widthNoScroll - widthWithScroll;
}



