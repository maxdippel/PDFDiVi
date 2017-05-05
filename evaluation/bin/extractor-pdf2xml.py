from extractor import Extractor
from lxml import etree

import file_util

p_xpath = """/html/body/p"""

class Pdf2XmlExtractor(Extractor):
    
    def create_plain_output(self, raw_output_path):
        """ 
        Formats the given file.
        """
     
        if not file_util.is_missing_or_empty_file(raw_output_path):
            xml = etree.parse(raw_output_path, etree.XMLParser(recover=True))
            p_nodes = xml.xpath(p_xpath)
            return "\n\n".join([x.text for x in p_nodes if x is not None and x.text is not None])
        return ""

if __name__ == "__main__":
    arg_parser = Extractor.get_argument_parser()
    args       = arg_parser.parse_args()
     
    Pdf2XmlExtractor(args).process()
