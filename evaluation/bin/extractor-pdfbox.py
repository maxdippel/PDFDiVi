from extractor import Extractor

class PdfBoxExtractor(Extractor):
    pass
    
if __name__ == "__main__":
    arg_parser = Extractor.get_argument_parser()
    args       = arg_parser.parse_args()
     
    PdfBoxExtractor(args).process()
