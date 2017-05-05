"""
Copyright 2016, University of Freiburg.
Chair of Algorithms and Data Structures.
Max Dippel <max.dippel@t-online.de>
"""


import sys
import os
import subprocess
import getopt
import para_diff_rearrange as rearr
import diff
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import portrait
from reportlab.lib.pagesizes import letter
from reportlab.platypus import PageBreak
from reportlab.lib.colors import PCMYKColor, PCMYKColorSep
from reportlab.lib.colors import Color, black, blue, red
from PyPDF2 import PdfFileWriter, PdfFileReader

class Rectangle(object):
    def __init__(self, page, x, y, width, height):
        self.page = page
        self.x = x
        self.y = y
        self.width = width
        self.height = height

class Operation(object):
    def __init__(self, start_idx, end_idx, words_actual, words_target, t, v, op_type):
        self.start_idx = start_idx
        self.op_type = op_type
        self.visualizer = v
        self.end_idx = end_idx
        self.words_actual = parse(words_actual)
        self.words_target = parse(words_target)
        self.type = t
        self.page = int(self.visualizer.tex_line_to_rects[start_idx][0].split(" ")[0])
        if self.page not in self.visualizer.page_to_operations:
            self.visualizer.page_to_operations[self.page] = []
        merge = False
        for op in self.visualizer.page_to_operations[self.page]:
            if self.type != op.type or self.op_type != op.op_type:
                continue
            if set(range(op.start_idx, op.end_idx +1)) & set(range(self.start_idx, self.end_idx + 1)):
                op.start_idx = min(self.start_idx, op.start_idx)
                op.end_idx = max(self.end_idx, op.end_idx)
                op.words_actual = op.words_actual + "\n<AND>\n" + self.words_actual
                op.words_target = op.words_target + "\n<AND>\n" + self.words_target
                op.page = min(self.page, op.page)
                merge = True
        if not merge:
            self.visualizer.page_to_operations[self.page].append(self)
        

    def to_string(self):
        rects = ""
        for i in range(self.start_idx, self.end_idx+1):
            if i not in self.visualizer.tex_line_to_rects:
                continue
            rects += "|" + "|".join(self.visualizer.tex_line_to_rects[i])
        s = "\n".join([">>", self.type + "|" + self.op_type, rects, self.words_actual, "--", self.words_target]) + "\n"
        return s


def parse(diffWords):
    s = ""
    for diffWord in diffWords:
        s += diffWord.wrapped.wrapped.unnormalized
    return s

"""
A class to visualize the differences between a pdf-text-extraction via LaTeX
and an extraction using pdftotext. The visualization is based on the original
pdf both extractors are using.
"""
class Visualizer(object):

    """
    pdf - the pdf to be dealt with.
    tex - the LaTeX file of the pdf.
    """
    def __init__(self, phrases, tex):
        self.tex = "input/src/" + tex.rstrip()
        self.phrases = phrases
        self.parse_tex()
        self.setup_position_links()
        self.process_operations()
        self.output_operations()

    def parse_tex(self):
        self.pdf = self.tex.rsplit('.', 1)[0] + ".pdf"
        self.txt = self.tex.rsplit('.', 1)[0] + ".txt"
        cmd = ['python3', 'bin/positioncalculator.py', '-i', self.tex, '-o',
                self.txt]
        print(" ".join(cmd))
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE,
                                stderr=subprocess.PIPE)
        proc.communicate()

    def setup_position_links(self):
        self.tex_line_to_rects = dict()
        with open(self.txt) as f:
            txt_lines = f.read().splitlines()#.split("/")#txt_lines = f.read().splitlines()
            c = 1
            for line in txt_lines:
                self.tex_line_to_rects[c] = []
                rects = line.split('/')
                for rect in rects:
                    if rect == "":
                        continue
                    
                    self.tex_line_to_rects[c].append(" ".join(str(round(float(a))) for a in rect.split(" ")))
                c+=1
            self.total_lines = c - 1

    def process_operations(self):
        self.page_to_operations = dict()
        last_tex = 1
        for phrase in self.phrases:
            if phrase.ignore:
                continue
                
            t = ""
            if isinstance(phrase, rearr.DiffRearrangePhrase):
                t = "Rearrange"
            elif isinstance(phrase, diff.DiffCommonPhrase):
                t = "Merge" if phrase.merge_before else t
                t = "Split" if phrase.split_before else t
            elif isinstance(phrase, diff.DiffReplacePhrase):
                t = "Replace" if phrase.words_actual and phrase.words_target else t
                t = "Delete" if phrase.words_actual and not phrase.words_target else t
                t = "Insert" if not phrase.words_actual and phrase.words_target else t
                       
            start_tex = phrase.tex_line_num_start
            end_tex = phrase.tex_line_num_end
            start_tex = start_tex if start_tex != -1 else (end_tex if end_tex!= -1 else last_tex)
            end_tex = end_tex if end_tex != -1 else (start_tex if start_tex != -1 else last_tex)
            op_type = phrase.op_type
            if t == "Delete":
                end_tex += 1
                
            while end_tex < self.total_lines and len(self.tex_line_to_rects[end_tex]) == 0:  # search down
                end_tex += 1
            if end_tex == self.total_lines:
                end_tex = last_tex
                while end_tex > 0 and len(self.tex_line_to_rects[end_tex]) == 0:  # search up
                    end_tex -= 1
                    
            if t == "Delete":
                start_tex = end_tex


            while start_tex > 0 and len(self.tex_line_to_rects[start_tex]) == 0:  # search up
                start_tex -= 1
            if start_tex == 0:
                start_tex = last_tex
                while start_tex < self.total_lines and len(self.tex_line_to_rects[start_tex]) == 0:  # search down
                    start_tex += 1

            

            

            if t != "":
                Operation(start_tex, end_tex, phrase.words_actual, phrase.words_target, t, self, op_type)
            last_tex = end_tex

    def output_operations(self):
        name = self.txt.rsplit('/', 1)[1].rsplit('.', 2)[0]
        txt_path = self.txt.replace(".txt", ".res.txt")#"res/vis_" + name + ".txt"
        pdf_path = self.txt.replace(".txt", ".pdf")  # http://sirba.informatik.privat/PDFDiVi/evaluation/
        with open(txt_path, 'w+') as f:
            for i in range(1, len(self.page_to_operations)+1):
                if i not in self.page_to_operations:
                    continue
                for op in self.page_to_operations[i]:
                    f.write(op.to_string())
        with open("source/default.html", "r") as f:
            prefab = f.read()
            prefab = prefab.replace('<INPUT_PDF>', "http://sirba.informatik.privat/PDFDiVi/evaluation/" + pdf_path)
            prefab = prefab.replace('<INPUT_TXT>', "http://sirba.informatik.privat/PDFDiVi/evaluation/" + txt_path)


            with open(name + ".html", 'w+') as g:
                g.write(prefab)
            
            

