import os
from lxml import etree
from extractor import Extractor

import file_util

blocks_xpath = """/DOCUMENT/PAGE/BLOCK"""
token_xpath  = """./TEXT/TOKEN"""

class PdfToXmlExtractor(Extractor):           
    def create_plain_output(self, raw_output_path):
        """ 
        Formats the given file.
        """
        
        #<DOCUMENT>
        #  <METADATA>
        #  ...
        #  </METADATA>
        #  <PAGE width="612" height="792" number="1" id="p1">
        #    ...
        #    <BLOCK id="p1_b1">
        #      <TEXT width="18" height="510.48" id="p1_t1" x="18.34" y="115.52">
        #        <TOKEN sid="p1_s3" id="p1_w1" ...>arXiv:cond-mat/0001220v1</TOKEN>
        #        <TOKEN sid="p1_s5" id="p1_w2" ...>[cond-mat.stat-mech]</TOKEN>
        #        <TOKEN sid="p1_s7" id="p1_w3" ...>17</TOKEN>
        #        <TOKEN sid="p1_s8" id="p1_w4" ...>Jan</TOKEN>
        #        <TOKEN sid="p1_s9" id="p1_w5" ...>2000</TOKEN>
        #      </TEXT>
        #    </BLOCK>
        #  </PAGE>
        #</DOCUMENT>
        
        formatted_lines = []       
        if not file_util.is_missing_or_empty_file(raw_output_path):
            xml = etree.parse(raw_output_path, etree.XMLParser(recover=True))
            block_nodes = xml.xpath(blocks_xpath)
            blocks = []
            for block_node in block_nodes:
                token_nodes = block_node.xpath(token_xpath)
                blocks.append(" ".join([x.text for x in token_nodes if x.text is not None]))      
            return "\n\n".join(blocks)
        return ""
        
if __name__ == "__main__":      
    arg_parser = Extractor.get_argument_parser()
    args       = arg_parser.parse_args()
     
    PdfToXmlExtractor(args).process()
